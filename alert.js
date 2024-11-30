const pg = require("pg");

const pool = new pg.Pool({
  user: "postgres",
  password: "",
  database: "valeriy",
  host: "127.0.0.1",
  port: 5432,
  max: 20,
});

const TelegramApi = require("node-telegram-bot-api");

const token = "";

const bot = new TelegramApi(token, { polling: false });
const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const main = () => {
  (async () => {
    const dangers = (
      await pool.query(`SELECT telegram_id FROM users WHERE alert_push = false`)
    ).rows;

    for (const danger of dangers) {
      try {
        await bot.sendMessage(
          danger.telegram_id,
          "<b><i>Уважаемые клиенты!</i></b>\n\nМы рады сообщить вам о запуске нашей новой реферальной программы! Теперь за каждого приглашенного друга вы получаете денежное вознаграждение на ваш баланс. Чем больше друзей вы пригласите, тем больше денег сможете накопить!\n\nИспользуйте эти средства для оплаты услуг нашего сервиса и наслаждайтесь возможностью пользоваться им <b><i>абсолютно бесплатно.</i></b> \n\n<b><i>Присоединяйтесь</i></b> к нашей реферальной программе и делитесь преимуществами нашего сервиса с друзьями!\n\nСпасибо, что остаетесь с нами!\n\nС уважением, <b><i>VPN Valera</i></b>",
          {
            parse_mode: "HTML",
            reply_markup: JSON.stringify({
              resize_keyboard: true,
              keyboard: [
                ["📱Мои устройства💻", "📅Мой баланс📅"],
                ["💵Пригласи друга💵"],
              ],
            }),
          }
        );
      } catch (e) {
        console.log(e);
      }
      await pool.query(
        `UPDATE users SET alert_push = true WHERE telegram_id = $1`,
        [danger.telegram_id]
      );
    }

    console.log("finish");

    await delay(1000);

    main();
  })().catch((e) => {
    console.log(e);

    setTimeout(main, 1000);
  });
};

main();
