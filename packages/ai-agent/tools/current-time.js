const currentTime = {
  definition: {
    name: "current_time",
    description: "获取当前日期和时间，以及所在时区。不需要任何参数。",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: 'string',
          description: '可选。时区，例如 "Asia/Shanghai", "America/New_York"，默认本地时区',
        },
      },
    },
  },

  execute: async ({ timezone } = {}) => {
    const now = new Date();
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString('zh-CN', { timeZone: tz }),
      date: now.toLocaleDateString('zh-CN', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('zh-CN', { timeZone: tz }),
      timezone: tz,
    });
  },
};

export default currentTime;
