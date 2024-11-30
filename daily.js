const pg = require("pg");
const axios = require("axios");
const TelegramApi = require("node-telegram-bot-api");

const token = "";

const bot = new TelegramApi(token, {
  polling: false,
});

const moment = require("moment");

const pool = new pg.Pool({
  user: "postgres",
  password: "",
  database: "valeriy",
  host: "127.0.0.1",
  port: 5432,
  max: 20,
});

const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

function dayTitle(number) {
  if (number > 10 && [11, 12, 13, 14].includes(number % 100)) return "дней";
  last_num = number % 10;
  if (last_num == 1) return "устройство";
  if ([2, 3, 4].includes(last_num)) return "устройства";
  if ([5, 6, 7, 8, 9, 0].includes(last_num)) return "устройств";
}

const main = () => {
  (async () => {
    const dailys = (
      await pool.query(
        `SELECT telegram_id, id, date_daily, push_null_money, balance FROM users WHERE date_daily <= $1`,
        [new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()]
      )
    ).rows;
    console.log(dailys);

    for (const daily of dailys) {
      const daily_id = daily.id;

      const balance = daily.balance;
      const date_daily = daily.date_daily;

      const how_many = (
        await pool.query(
          `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
          [daily_id]
        )
      ).rows[0].count;
      const newbalance = 5 * how_many;

      if (date_daily < Date.now() - 1 * 24 * 3600 * 1000) {
        if (balance >= newbalance) {
          var datenow = new Date(Date.now());
          const how_days = balance / newbalance;

          await pool.query(
            `UPDATE users SET balance = balance - $1, date_daily = $2, days = $3, last_succes_daily = $5, push_null_money = $6 WHERE id = $4`,
            [newbalance, datenow, how_days, daily_id, true, false]
          );
        } else {
          const id_start = daily.id;
          const how_many = (
            await pool.query(
              `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
              [id_start]
            )
          ).rows[0].count;
          const how_gat = how_many * 150;

          const gadget_how = dayTitle(how_many);
          const send_by_month = [];

          send_by_month.push(
            [
              {
                text: `150₽ (${Math.round((150 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "150",
              },
              {
                text: `300₽ (${Math.round((300 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "300",
              },
            ],
            [
              {
                text: `450₽ (${Math.round((450 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "450",
              },
              {
                text: `600₽ (${Math.round((600 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "600",
              },
            ],
            [
              {
                text: `1000₽ (бонус 500₽) (${Math.round((1500 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "1000",
              },
            ],
            [
              {
                text: `1500₽ (бонус 1050₽) (${Math.round((2550 / (how_many * 150)) * 10) / 10} мес.)`,
                callback_data: "1500",
              },
            ]
          );

          if (daily.push_null_money == false) {
            try {
              await bot.sendMessage(
                daily.telegram_id,
                `Уважаемый пользователь, на вашем счёте закончились денежные средства, сервис приостановлен.\n\n Для оплаты выберите тариф, <b><i>За пополнение от 1000 рублей, зачисляем на баланс больше денежных средств</i></b>`,
                {
                  parse_mode: "HTML",
                  reply_markup: JSON.stringify({
                    inline_keyboard: send_by_month,
                  }),
                }
              );
            } catch (e) {
              console.log(e);
            }
          }

          await pool.query(
            `UPDATE users SET balance = $1, last_succes_daily = $3, push_null_money = $4, date_daily = $5 WHERE id = $2`,
            [0, daily_id, false, true, datenow]
          );
        }
      }
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
