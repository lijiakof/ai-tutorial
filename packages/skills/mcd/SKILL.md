---
name: mcd
description: Use when users ask to order McDonald's, search McDonald's stores/products, query order status/pickup code, cancel an order, or mention 麦当劳、金拱门、麦乐送、得来速、团餐、汉堡、小食、麦咖啡.
keywords:
  - 麦当劳
  - 金拱门
  - 麦乐送
  - 得来速
  - 团餐
  - 汉堡
  - 小食
  - 麦咖啡
  - 点单
  - 下单
  - 门店
  - 取餐码
  - 订单状态
  - 取消订单
  - 积分兑换
  - 优惠券
  - 领券
packageType: instruction-skill
instructionOnly: true
metadata:
  version: 0.1.0
  openclaw:
    requiredMcp:
      - mcd-mcp
    requiresNetwork: true
    dataClassification: payment-order
---

# 麦当劳下单助手

## 前置条件

**必需 MCP Server**: `mcd-mcp`

优先使用名为 `mcd-mcp` 的 MCP server；若当前智能体暴露的是同一麦当劳 MCP 的其它别名，以实际可用 server 名为准。

**MCP 配置**:

```json
{
  "mcd-mcp": {
    "type": "streamableHttp",
    "url": "https://mcp.mcd.cn",
    "headers": {
      "Authorization": "Bearer ${MCD_MCP_TOKEN}"
    }
  }
}
```

**安全说明**:

- `MCD_MCP_TOKEN` 读取优先级：环境变量 `MCD_MCP_TOKEN` > 当前对话用户明确提供的 token > 本地文件 `~/.mcd/MCD_MCP_TOKEN`（仅在用户明确同意记录后可使用）。
- 如果用户在当前或历史消息里发过完整 token，应先尝试该 token，不要直接让用户重新登录平台获取。
- 用户发送 token 时必须先询问是否记录到 `~/.mcd/MCD_MCP_TOKEN` 供后续对话复用；只有用户明确同意才可写入，禁止静默保存。
- 写入 token 前确保目录存在（`mkdir -p ~/.mcd`）；写入后建议限制权限（如 `chmod 600 ~/.mcd/MCD_MCP_TOKEN`）。
- 用户要求撤销保存时，删除本地 token 文件 `~/.mcd/MCD_MCP_TOKEN`，并明确告知"后续将不再从本地文件复用 token"。
- 除非用户明确要求 MCP 配置，否则不要输出 Authorization token。
- 真实 MCP 请求必须使用完整 token：优先 `Authorization: Bearer ${MCD_MCP_TOKEN}`；若用户已提供 token，则使用用户提供的完整原文。
- 禁止执行 `Bearer ***`、`Bearer xxx…yyy`、`Bearer <token>` 等占位 Authorization；如果没有环境变量且用户也没提供 token，只提示用户配置或提供 `MCD_MCP_TOKEN` 后重试。
- 首次调用某 MCP 工具前，或不确定参数时，先读取对应工具 descriptor/schema；本文参数只是快速参考，实际以 schema 为准。

## MCP 调用模式

优先调用当前智能体已配置的 `mcd-mcp` MCP 工具。若当前智能体没有配置 MCP server，但可拿到有效 token（环境变量 / 用户在对话中提供 / 本地文件 `~/.mcd/MCD_MCP_TOKEN`），使用 `curl` 调用 MCP HTTP 接口。

建议先组装 token：

```bash
TOKEN="${MCD_MCP_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f ~/.mcd/MCD_MCP_TOKEN ]; then
  TOKEN="$(cat ~/.mcd/MCD_MCP_TOKEN)"
fi
```

查看工具列表和 schema：

```bash
curl -s -N "${MCD_MCP_URL:-https://mcp.mcd.cn}" \
  -H "Authorization: Bearer ${TOKEN:-$MCD_MCP_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

调用工具：

```bash
curl -s -N "${MCD_MCP_URL:-https://mcp.mcd.cn}" \
  -H "Authorization: Bearer ${TOKEN:-$MCD_MCP_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"TOOL_NAME","arguments":{}},"id":1}'
```

将 `TOOL_NAME` 替换为实际工具名，将 `arguments` 替换为工具 schema 要求的参数。从 `result.content[0].text`、`result.structuredContent` 或 SSE `data:` 事件中解析返回结果。

## 业务类型 (beType) 说明

麦当劳支持四种业务场景，不同场景的参数传递规则不同：

| beType | 场景 | orderType | beCode | 取餐方式 |
|--------|------|-----------|--------|----------|
| 1 | 到店自取 | 1 | 不传 | 堂食/外带 |
| 2 | 麦乐送（外送到家） | 2 | 必传（来自 delivery-query-stores） | 配送 |
| 5 | 得来速（Drive Through） | 1 | 必传（来自 query-nearby-stores） | 车道取餐 |
| 6 | 企业团餐 | 2 | 必传（来自 delivery-query-stores） | 配送 |

**orderType/beCode 传递规则**：
- 到店自取(beType=1)：orderType=1，不传 beCode
- 得来速(beType=5)：orderType=1，必传 beCode（从 query-nearby-stores 获取）
- 麦乐送(beType=2)：orderType=2，必传 beCode（从 delivery-query-stores 获取）
- 团餐(beType=6)：orderType=2，必传 beCode（从 delivery-query-stores 获取）

## 执行优先级（严格约束，单一真源）

以下为强约束，优先级高于其余章节；如有重复描述，以本节为准：

1. **Schema 优先**：首次调用工具前或参数不确定时，必须先读取工具 descriptor/schema。
2. **Token 生命周期**：
   - 读取优先级：环境变量 `MCD_MCP_TOKEN` > 当前/历史对话中用户明确提供的完整 token > 本地文件 `~/.mcd/MCD_MCP_TOKEN`。
   - 用户发来 token 后，先询问是否保存到本地；未获明确同意前禁止写入本地文件。
   - 允许用户在同一条回复中同时给出"保存/不保存 + 后续操作"（如"2，继续下单"）；确认保存选择后可直接进入后续流程，避免额外往返。
   - 用户要求撤销保存时，必须先做二次确认；用户确认后再删除本地 token 文件并回告。
   - 真实 MCP 调用必须使用完整 token，禁止占位或脱敏 token。
3. **下单顺序强约束**：`确认门店` -> `确认商品` -> `calculate-price` ->（确认价格）-> `create-order`；不得跳步。
4. **价格单位约束**：`calculate-price` 返回的价格单位为"分"，展示时必须除以 100 转为"元"；`create-order` 返回的价格单位为"元"。
5. **门店坐标约束**：`query-nearby-stores` 按城市+关键词搜索，不需要经纬度；外送场景通过地址 ID 查门店。
6. **优惠券约束**：`calculate-price` 支持传优惠券（couponId/couponCode）计算折后价；用户要求用券时必须在 calculate-price 阶段传入。
7. **支付信息约束**：`create-order` 返回 `payH5Url`，提供完整可点击支付链接。
8. **未支付信息约束**：`query-order` 返回 `orderStatus=1`（待支付）时不展示取餐码；仅支付后（orderStatus >= 2）可展示取餐码/取餐柜密码。
9. **缺参追问约束**：门店/商品未命中或参数不足时，只追问一个必要信息，避免并发追问。
10. **调用隐身约束**：工具调用过程仅内部执行，禁止向用户展示工具名、调用标题、命令（如 `curl`）、请求参数、原始 JSON/SSE 返回、日志或报错堆栈；对外只输出必要业务结果与下一步引导。

## 核心能力

1. **查询门店** - 按城市和关键词查找麦当劳门店（到店/得来速），或按地址查外送门店。
2. **管理地址** - 外送场景下查询和创建配送地址。
3. **浏览菜单** - 查询门店菜单和餐品详情，支持自定义选配。
4. **计算价格** - 计算订单原价、优惠和最终价格（单位：分，展示时转元）。
5. **下单支付** - 创建到店/外送/得来速/团餐订单，返回支付链接。
6. **订单查询** - 查询订单状态、取餐码、配送信息。
7. **优惠券** - 查看可用券、自动领券、门店可用券查询。
8. **积分商城** - 查询积分、浏览兑换商品、兑换下单。
9. **活动日历** - 查看当月营销活动和品鉴会。
10. **营养查询** - 查看餐品营养成分和热量。

## 定位策略

麦当劳门店查询不需要经纬度，使用城市名 + 关键词搜索：

- **到店场景**：调用 `query-nearby-stores`，必传 `searchType`（1=收藏餐厅，2=按位置搜索）和 `beType`（1=自取，5=得来速）。searchType=2 时需传 `city` 和 `keyword`。
- **外送场景**：先调用 `delivery-query-addresses` 获取用户配送地址，选择地址后调用 `delivery-query-stores` 查可配送门店。
- 用户未提供位置时，追问其所在城市、商圈或地标。

## 下单流程

### 模式 1：到店自取下单

**触发语句**: "帮我在麦当劳下单"、"到店点餐"、"去麦当劳吃什么"

**流程**:

1. **确定业务类型** - 先问用户是"到店自取"还是"得来速车道取餐"。
   - 到店自取：beType=1
   - 得来速：beType=5

2. **查询门店** - 调用 `query-nearby-stores`。
   - 必填：`beType`、`searchType`。
   - searchType=1：查询收藏餐厅（无需 city/keyword）。
   - searchType=2：按位置搜索，需传 `city` 和 `keyword`。
   - 默认列出返回的前 5 个门店，包含门店名称、地址、营业时间和距离。
   - 如有预约选项（reservationTimeOptions），完整展示给用户。

3. **确认门店** - 搜索商品前必须先让用户确认门店。
   - 用户确认后保存 `storeCode`、`beType`，得来速还需保存 `beCode`。
   - 如果没有用户需要的门店，引导用户提供城市和关键词重新查询。

4. **浏览菜单** - 调用 `query-meals`。
   - 必填：`storeCode`、`orderType`、`beType`。
   - 到店自取(beType=1)：orderType=1，不传 beCode。
   - 得来速(beType=5)：orderType=1，必传 beCode。
   - 返回菜单分类和餐品列表，展示给用户选择。

5. **查看餐品详情** - 用户对某餐品感兴趣时调用 `query-meal-detail`。
   - 必填：`storeCode`、`orderType`、`beType`、`code`（餐品编码）。
   - 展示餐品选配轮次（rounds），引导用户选择规格。

6. **确认下单意图** - 汇总用户选择的商品，展示：
   - 门店名称、地址、营业时间
   - 商品名、规格、数量
   - 明确说明：确认后会先调用 `calculate-price` 计算最终价格。

7. **计算价格** - 用户确认后调用 `calculate-price`。
   - 必填：`storeCode`、`orderType`、`beType`、`items`（含 productCode、quantity）。
   - 如果用户要用优惠券，先调用 `query-store-coupons` 获取可用券，再传入 `calculate-price`。
   - 返回价格为"分"，展示时除以 100 转为"元"（如 `price: 2500` → `¥25.00`）。
   - 展示：原价、优惠金额、最终价格、打包费、配送费（如有）、可取餐方式（takeWayList）。

8. **创建订单** - 用户确认价格后调用 `create-order`。
   - 必填：`storeCode`、`orderType`、`beType`、`items`。
   - 到店自取需传 `takeWayCode`（从 calculate-price 的 takeWayList 选取）。
   - 展示：订单号、门店名称、商品明细、金额（create-order 返回单位为元）、支付链接 `[打开支付链接](payH5Url)`。
   - 创建成功后固定追加：`支付完成后告诉我一声，我可以帮你查询订单状态和取餐码。` 并提示：`1. 已支付，帮我查取餐码`、`2. 还没支付，稍后再查`。

### 模式 2：外送（麦乐送/团餐）下单

**触发语句**: "帮我点麦乐送"、"麦当劳送到家"、"点团餐"

**流程**:

1. **确定业务类型** - 麦乐送 beType=2，团餐 beType=6。

2. **查询配送地址** - 调用 `delivery-query-addresses`。
   - 如果用户没有地址，引导创建：调用 `delivery-create-address`。
   - 必填：`city`、`contactName`、`phone`、`address`、`addressDetail`。可选：`gender`。
   - 用户选择地址后保存 `addressId`。

3. **查询可配送门店** - 调用 `delivery-query-stores`。
   - 必填：`addressId`、`beType`。
   - 展示门店列表，用户确认后保存 `storeCode`、`beCode`。

4. **浏览菜单 → 确认商品 → 计算价格 → 创建订单** - 同到店自取流程步骤 4-8。
   - orderType=2，必传 beCode。
   - 团餐(beType=6)在 calculate-price 前需调用 `query-meal-assistance` 获取助餐服务，传入 `calculate-price` 和 `create-order`。
   - 团餐需引导用户提供预算和人数。

5. **创建订单** - 外送场景需传 `addressId`。

### 模式 3：查询订单

**触发语句**: "查订单"、"订单状态"、"取餐码"、"做好了吗"

**流程**:

1. 优先使用当前对话里最近的 `orderId`，没有则询问用户。
2. 调用 `query-order`。
3. 展示：
   - 订单状态（1待支付、2配餐中、4配送中、6已完成、7已取消、10餐厅确认配餐中）
   - 门店名称、商品明细、金额
   - 仅当已支付（orderStatus >= 2）时展示取餐码（`pickupCode`）和配送信息。
   - 外送订单展示配送骑士信息。

### 模式 4：取消订单

**触发语句**: "取消订单"、"帮我退掉"、"不要了"

**流程**:

1. 优先使用当前对话里最近的 `orderId`，没有则询问用户。
2. 麦当劳 MCP 暂不提供取消订单工具，引导用户前往麦当劳 APP 或联系门店取消。

### 模式 5：优惠券

**触发语句**: "领券"、"有什么优惠券"、"这个门店能用什么券"

**流程**:

1. **查看可用券** - 调用 `available-coupons`（可领取列表）或 `query-my-coupons`（已持有券）。
2. **自动领券** - 调用 `auto-bind-coupons`，展示领取结果（成功/失败数量）。
3. **门店可用券** - 调用 `query-store-coupons`，需传 `storeCode`、`orderType`、`beType`。

### 模式 6：积分商城

**触发语句**: "积分兑换"、"我有多少积分"、"积分商城"

**流程**:

1. **查积分** - 调用 `query-my-account`，展示可用积分和即将过期积分。
2. **浏览兑换商品** - 调用 `mall-points-products`，可选 `catRules` 筛选。
3. **查看商品详情** - 调用 `mall-product-detail`，传 `spuId`。
4. **兑换下单** - 调用 `mall-create-order`，必传 `skuId`、`spuCategory`。实物商品(spuCategory=2)需传 `addressId`。
   - 多商品需逐个下单（等上一个完成再下一个），禁止批量创建。

### 模式 7：活动日历

**触发语句**: "最近有什么活动"、"这个月有什么优惠"

- 调用 `campaign-calendar`，可选 `specifiedDate` 指定日期。

### 模式 8：营养查询

**触发语句**: "汉堡热量"、"这个餐品多少卡路里"、"帮我搭配低卡套餐"

- 调用 `list-nutrition-foods`，获取餐品营养成分数据。

## 工具参考

### query-nearby-stores

**用途**: 到店场景下查询附近门店。
**参数**:

- `beType` integer，必填：1=到店自取，5=得来速
- `searchType` integer，必填：1=收藏餐厅，2=按位置搜索
- `city` string，searchType=2 时必填
- `keyword` string，searchType=2 时必填

### delivery-query-addresses

**用途**: 查询用户配送地址列表。
**参数**: 无

### delivery-create-address

**用途**: 创建配送地址。
**参数**:

- `city` string，必填
- `contactName` string，必填
- `phone` string，必填，11 位数字
- `address` string，必填
- `addressDetail` string，必填
- `gender` string，可选

### delivery-query-stores

**用途**: 外送场景下查询可配送门店。
**参数**:

- `addressId` string，必填
- `beType` integer，必填：2=麦乐送，6=团餐

### query-meals

**用途**: 查询门店餐品菜单。
**参数**:

- `storeCode` string，必填
- `orderType` integer，必填：1=到店，2=外送
- `beType` integer，必填
- `beCode` string，得来速/外送/团餐必传，到店自取不传
- `reservationDate` string，预约场景必传，格式 `yyyy-MM-dd HH:mm`

### query-meal-detail

**用途**: 查询餐品详情和选配选项。
**参数**:

- `storeCode` string，必填
- `orderType` integer，必填
- `beType` integer，必填
- `code` string，必填，餐品编码
- `beCode` string，得来速/外送/团餐必传
- `reservationDate` string，预约场景必传

### calculate-price

**用途**: 计算订单价格（含优惠）。返回价格单位为"分"。
**参数**:

- `storeCode` string，必填
- `orderType` integer，必填
- `beType` integer，必填
- `items` array，必填：`[{productCode, quantity, couponId?, couponCode?}]`
- `beCode` string，得来速/外送/团餐必传
- `gmServiceCode` string，团餐必传
- `reservationDate` string，预约场景必传

### create-order

**用途**: 创建订单。返回价格单位为"元"。
**参数**:

- `storeCode` string，必填
- `orderType` integer，必填
- `beType` integer，必填
- `items` array，必填：`[{productCode, quantity, couponId?, couponCode?}]`
- `beCode` string，得来速/外送/团餐必传
- `takeWayCode` string，到店/得来速必传（从 calculate-price 的 takeWayList 选取）
- `addressId` string，外送/团餐必传
- `gmServiceCode` string，团餐必传
- `reservationDate` string，预约场景必传

### query-order

**用途**: 查询订单详情。
**参数**:

- `orderId` string，必填

### query-my-coupons

**用途**: 查询用户持有的优惠券。
**参数**:

- `page` string，可选
- `pageSize` string，可选

### query-store-coupons

**用途**: 查询指定门店可用的优惠券。
**参数**:

- `storeCode` string，必填
- `orderType` integer，必填
- `beType` integer，必填
- `beCode` string，得来速/外送/团餐必传
- `reservationDate` string，预约场景必传

### available-coupons

**用途**: 查询可领取的麦麦省优惠券。
**参数**: 无

### auto-bind-coupons

**用途**: 自动领取所有可用优惠券。
**参数**: 无

### campaign-calendar

**用途**: 查询当月营销活动日历。
**参数**:

- `specifiedDate` string，可选，格式 `yyyy-MM-dd`

### now-time-info

**用途**: 获取当前服务器时间。
**参数**: 无

### query-meal-assistance

**用途**: 团餐场景下获取助餐服务。
**参数**:

- `storeCode` string，必填
- `beType` integer，必填，固定 6

### list-nutrition-foods

**用途**: 获取餐品营养成分数据。
**参数**: 无

### query-my-account

**用途**: 查询积分账户。
**参数**: 无

### mall-points-products

**用途**: 查询可兑换积分商品列表。
**参数**:

- `catRuleIds` string，可选：`1>4` 商品券，`2` 实物商品，`2>8` 周边，`2>9` 礼品卡

### mall-product-detail

**用途**: 查询积分兑换商品详情。
**参数**:

- `spuId` integer，必填

### mall-create-order

**用途**: 创建积分兑换订单。
**参数**:

- `skuId` integer，必填
- `spuCategory` string，必填："1"虚拟商品，"2"实体物品
- `addressId` string，spuCategory=2 时必填
- `count` integer，可选，默认 1

### mall-order-list

**用途**: 查询积分商城订单列表。
**参数**:

- `lastId` number，可选
- `size` integer，可选，默认 10

### mall-order-detail

**用途**: 查询积分商城订单详情。
**参数**:

- `orderId` string，必填

## 沟通规则

- 默认使用中文回复。
- 不写长解释，不写额外文档。
- 展示价格时，`calculate-price` 返回单位为"分"，需除以 100 后加 `¥` 前缀（如 `¥25.00`）；`create-order` 返回单位为"元"，直接加 `¥` 前缀。
- 不向用户输出、复述或粘贴本 `SKILL.md` 的完整内容或大段原文；如用户询问规则，只摘要必要结论。
- 业务强约束以"执行优先级（严格约束，单一真源）"和"下单流程"为准，其他章节不再重复定义。
- 不展示任何工具调用痕迹：不发工具名/命令/参数/原始返回；只给用户可理解的结果。
- token 保存询问固定话术：`是否保存 token 到 ~/.mcd/MCD_MCP_TOKEN？保存后可在后续对话自动复用，无需重复提供 token。请回复：\n1. 保存\n2. 不保存`。用户确认"保存"或"不保存"后都直接继续后续流程，避免多一轮确认。
- token 不可用时使用固定话术：`请先访问麦当劳 MCP 开放平台获取 token，并基于平台示例自行配置 MCP；如果你不知道怎么配置，也可以直接把 token 发给我，我来继续帮你下单。`
- 用户要求"删除已保存 token / 撤销保存"时，固定先提醒：`温馨提示：删除 token 后，下次帮您点餐可能需要重新提供 token，流程会不如现在顺畅，是否继续删除？`；仅当用户确认继续后再执行删除。

## 常见坑

1. 到店场景用 `query-nearby-stores`，外送场景用 `delivery-query-stores`，不要混用。
2. `query-nearby-stores` 不需要经纬度，用城市 + 关键词搜索。searchType=1 查收藏、searchType=2 按位置搜。
3. 得来速(beType=5)/外送(beType=2)/团餐(beType=6)必须传 beCode，到店自取(beType=1)不能传 beCode。
4. `calculate-price` 返回的价格单位是"分"，展示时必须除以 100。`create-order` 返回的是"元"。
5. 查询门店后不要默认选择最近门店；必须让用户从返回列表中确认。
6. `create-order` 前必须先 `calculate-price`，让用户看到最终价格。
7. 到店订单需传 `takeWayCode`，外送订单需传 `addressId`。
8. 优惠券要在 `calculate-price` 阶段传入（couponId/couponCode），不要等到 `create-order`。
9. 团餐场景在 `calculate-price` 前需调用 `query-meal-assistance` 获取助餐服务。
10. 积分商城兑换多商品时需逐个下单，不能批量创建。
11. 麦当劳 MCP 目前没有取消订单工具，需引导用户前往 APP 或联系门店。
12. 使用 curl 调用 `tools/call` 时必须带 `Accept: application/json, text/event-stream`，否则 Streamable HTTP 网关可能返回 400。
13. 下单时如用户未指定 beType，必须先问清楚是到店、外送还是得来速。
