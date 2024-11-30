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

const main = () => {
  (async () => {
    const billings = (
      await pool.query(
        `SELECT id, id_billing, user_id, trial FROM payment WHERE paid = FALSE AND created_at >= $1`,
        [new Date(Date.now() - 0.5 * 24 * 3600 * 1000).toISOString()]
      )
    ).rows;

    for (const billing of billings) {
      await delay(500);

      const data = await axios.get(
        `https://api.yookassa.ru/v3/payments/${billing.id_billing}`,
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

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const user = (
          await client.query(
            `SELECT telegram_id, first_enter FROM users WHERE id = $1 FOR UPDATE;`,
            [billing.user_id]
          )
        ).rows;

        if (!user) continue;

        const paid_status = data.data.paid;
        const trial_status = (
          await client.query(
            `SELECT trial FROM payment WHERE id_billing = $1`,
            [billing.id_billing]
          )
        ).rows[0].trial;

        if (paid_status === true) {
          const percent = data.data.amount.value;
          await bot.sendMessage(
            7457390746,
            `Пользователь ${billing.user_id}, платежка оплачена на ${percent}`
          );

          let newbalance = Math.floor(percent);

          let updatedBalance;

          if (newbalance < 1000) {
            updatedBalance = newbalance;
          } else if (newbalance == 1000) {
            updatedBalance = 1500;
          } else if (newbalance == 1500) {
            updatedBalance = 2500;
          }
          await client.query(
            `UPDATE users SET balance = balance + $1, last_succes_daily = $3, first_enter = $3, first_marketing = $4 WHERE id = $2`,
            [updatedBalance, billing.user_id, true, false]
          );
          await client.query(
            `UPDATE payment SET paid = true, date = $2 WHERE id = $1`,
            [billing.id, data.data.captured_at]
          );
          try {
            await bot.sendMessage(user.telegram_id, "Баланс пополнен");
          } catch (e) {
            console.log(e);
          }

          const reccurent_key = data.data.payment_method.id;
          const save_key = data.data.payment_method.saved;
          if (reccurent_key !== null && save_key == true) {
            await client.query(
              `UPDATE payment SET payment_id = $1 WHERE id = $2`,
              [reccurent_key, billing.id]
            );
          }
        }

        if (billing.trial == true && paid_status == true) {
          const data1 = await axios.post(
            `https://api.yookassa.ru/v3/payments/${billing.id_billing}/cancel`,
            {},
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

          await client.query(
            `UPDATE users SET balance = $1, days = $3 WHERE id = $2`,
            [35, billing.user_id, 7]
          );

          console.log("111");
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
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
