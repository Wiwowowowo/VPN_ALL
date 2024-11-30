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

const tarifOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Пополнить баланс",
          callback_data: "1",
        },
      ],
    ],
  }),
};

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
    const paid_tills = (
      await pool.query(
        `SELECT * FROM (SELECT telegram_id, first_marketing, id, push, first_marketing, email, reccurent_pay, t1.count as devices, balance, (balance / (t1.count * 5)) as days FROM users LEFT JOIN LATERAL (SELECT count(*) FROM devices WHERE devices.user_id = users.id AND is_active = TRUE) AS t1 ON TRUE  WHERE reccurent = true) AS t2 WHERE devices > 0 AND days <= $1;`,
        [4]
      )
    ).rows;

    for (const paid_till of paid_tills) {
      const user_tg = paid_till.telegram_id;

      const d = new Date(Date.now());

      const token = (
        await pool.query(
          `SELECT payment_id, days FROM payment WHERE user_id = $1 and payment_id IS NOT NULL`,
          [paid_till.id]
        )
      ).rows;

      if (paid_till.push === null && paid_till.days <= 4 && token.length > 0) {
        try {
          await bot.sendMessage(
            user_tg,
            "До конца подписки осталось 4 дня, оплата в размере 150 рублей спишется завтра автоматически. Вы можете выбрать более выгодный тариф, нажав на кнопку:",
            tarifOptions
          );
        } catch (e) {
          console.log(e);
        }
        await pool.query(
          `UPDATE users SET push = $1, reccurent_pay = $1 WHERE id = $2`,
          [d, paid_till.id]
        );
      } else if (
        paid_till.push === null &&
        paid_till.days <= 4 &&
        token.length == 0 &&
        paid_till.first_marketing == true
      ) {
        const id_start = paid_till.id;
        const how_many = paid_till.devices;

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
              text: `1500₽ (бонус 1000₽) (${Math.round((2550 / (how_many * 150)) * 10) / 10} мес.)`,
              callback_data: "1500",
            },
          ]
        );

        try {
          await bot.sendMessage(
            user_tg,
            `До конца подписки осталось 4 дня, пополнить баланс вы можете нажав кнопки снизу. \n\nТариф ${how_gat} ₽/мес за ${how_many} ${gadget_how}\n\n<b><i>За пополнение от 1000 рублей, зачисляем на баланс больше денежных средств</i></b>`,
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

        await pool.query(
          `UPDATE users SET push = $1, reccurent_pay = $1 WHERE id = $2`,
          [d, paid_till.id]
        );
      } else if (
        token.length > 0 &&
        paid_till.reccurent_pay != null &&
        Date.now() - 1 * 24 * 3600 * 1000 >= paid_till.reccurent_pay.valueOf()
      ) {
        const reccurent_keys = token;

        for (const reccurent_key of reccurent_keys) {
          const email = paid_till.email;
          const value = 150;
          const payment_id = reccurent_key.payment_id;
          const data = await axios.post(
            "https://api.yookassa.ru/v3/payments",
            {
              amount: {
                value: value,
                currency: "RUB",
              },
              payment_method_id: payment_id,
              description: "Информационные услуги",
              capture: true,
              save_payment_method: true,
              receipt: {
                tax_system_code: 3,
                customer: {
                  email: email,
                },
                items: [
                  {
                    description: "Информационные услуги",
                    amount: {
                      value: value,
                      currency: "RUB",
                    },
                    vat_code: 1,
                    quantity: 1,
                    payment_subject: "service",
                    payment_mode: "full_payment",
                  },
                ],
              },
            },
            {
              headers: {
                "Idempotence-Key": Math.random().toString(32).slice(2),
                "Content-Type": "application/json",
                Authorization:
                  "Basic " +
                  Buffer.from(
                    "461817:live_4ikxl2jslzxCYQadh6EAHszJwsX62KIkKHI5XRhc68s"
                  ).toString("base64"),
              },
            }
          );
          if (data.data.paid == true) {
            await bot.sendMessage(
              7457390746,
              `Пользователь ${paid_till.id} оплатил по автореккуренту на 150 рублей`
            );

            const balance = (
              await pool.query(`SELECT balance FROM users WHERE id = $1`, [
                paid_till.id,
              ])
            ).rows[0].balance;
            const how_many = (
              await pool.query(
                `SELECT COUNT(*) FROM devices WHERE user_id = $1`,
                [paid_till.id]
              )
            ).rows[0].count;
            const newbalance = balance + 150;
            const newdays = newbalance / (how_many * 5);

            await pool.query(
              `UPDATE users SET days = $1, balance = $2, push = null, reccurent_pay = null, last_succes_daily = $4 WHERE id = $3`,
              [newdays, newbalance, paid_till.id, true]
            );

            await pool.query(
              `INSERT into payment (user_id, id_billing, paid, date, payment_id, amount) values($1, $2, $3, $4, $5, $6)`,
              [
                paid_till.id,
                data.data.id,
                true,
                data.data.captured_at,
                data.data.payment_method.id,
                150,
              ]
            );

            await bot.sendMessage(
              paid_till.telegram_id,
              `Успешно пополнен баланс на 150 рублей`
            );
            break;
          } else {
            await pool.query(
              `UPDATE users SET reccurent_pay = $1 WHERE id = $2`,
              [new Date().toISOString(), paid_till.id]
            );
          }

          await delay(5000);
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
