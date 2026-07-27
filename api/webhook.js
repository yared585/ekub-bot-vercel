const { Telegraf } = require("telegraf");
const { load, save } = require("../lib/store");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const bot = new Telegraf(BOT_TOKEN);

function isAdmin(ctx) {
  if (ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(String(ctx.from.id));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

bot.start((ctx) =>
  ctx.reply(
    "Ekub Tracker Bot\n\n" +
      "Commands:\n" +
      "/setorder Name1, Name2, Name3 - set the rotation (admin)\n" +
      "/order - show full rotation and who's next\n" +
      "/winner - show this week's winner\n" +
      "/next - mark current winner paid, move to next (admin)\n" +
      "/history - show past winners\n" +
      "/addmember Name - add someone to the end of the rotation (admin)"
  )
);

bot.command("setorder", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("Only an admin can set the order.");
  const text = ctx.message.text.replace("/setorder", "").trim();
  if (!text) return ctx.reply("Usage: /setorder Name1, Name2, Name3");
  const order = text.split(",").map((n) => n.trim()).filter(Boolean);
  if (order.length === 0) return ctx.reply("Couldn't find any names.");
  const data = await load();
  data.order = order;
  data.currentIndex = 0;
  data.history = [];
  await save(data);
  await ctx.reply(`Rotation set:\n${order.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nFirst up: ${order[0]}`);
});

bot.command("addmember", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("Only an admin can add members.");
  const name = ctx.message.text.replace("/addmember", "").trim();
  if (!name) return ctx.reply("Usage: /addmember Name");
  const data = await load();
  data.order.push(name);
  await save(data);
  await ctx.reply(`Added ${name}. Full order:\n${data.order.map((n, i) => `${i + 1}. ${n}`).join("\n")}`);
});

bot.command("order", async (ctx) => {
  const data = await load();
  if (data.order.length === 0) return ctx.reply("No rotation set yet. Use /setorder Name1, Name2, Name3");
  const lines = data.order.map((n, i) => `${i + 1}. ${n}${i === data.currentIndex ? " <- this week" : ""}`);
  await ctx.reply(lines.join("\n"));
});

bot.command("winner", async (ctx) => {
  const data = await load();
  if (data.order.length === 0) return ctx.reply("No rotation set yet. Use /setorder Name1, Name2, Name3");
  await ctx.reply(`This week's Ekub winner: ${data.order[data.currentIndex % data.order.length]}`);
});

bot.command("next", async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply("Only an admin can advance the rotation.");
  const data = await load();
  if (data.order.length === 0) return ctx.reply("No rotation set yet. Use /setorder Name1, Name2, Name3");
  const paidOut = data.order[data.currentIndex % data.order.length];
  data.history.push({ name: paidOut, date: todayStr() });
  data.currentIndex = (data.currentIndex + 1) % data.order.length;
  await save(data);
  const nextWinner = data.order[data.currentIndex];
  const roundsCompleted = Math.floor(data.history.length / data.order.length);
  const roundNote = data.currentIndex === 0 ? ` A full round just completed (round ${roundsCompleted}).` : "";
  await ctx.reply(`Marked ${paidOut} as paid.${roundNote}\nNext up: ${nextWinner}`);
});

bot.command("history", async (ctx) => {
  const data = await load();
  if (data.history.length === 0) return ctx.reply("No winners recorded yet.");
  await ctx.reply(data.history.map((h, i) => `${i + 1}. ${h.name} - ${h.date}`).join("\n"));
});

module.exports = async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(200).send("OK");
  }
};
