const { kv } = require("@vercel/kv");

const KEY = "ekub:data";

function defaultData() {
  return { order: [], currentIndex: 0, history: [], adminIds: [] };
}

async function load() {
  const data = await kv.get(KEY);
  return data || defaultData();
}

async function save(data) {
  await kv.set(KEY, data);
}

module.exports = { load, save };
