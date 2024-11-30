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
    const null_devices = (
      await pool.query(
        `select user_id, sum(sum) from devices left join lateral (select device_id, sum(use_traffic) from devices_servers where is_active = true and devices_servers.device_id = devices.id group by device_id) as t1 on true where is_active = true and created_at <= $1 and (sum is null or sum = 0) group by user_id`,
        [new Date(Date.now() - 0.125 * 24 * 3600 * 1000).toISOString()]
      )
    ).rows;
    for (const null_device of null_devices) {
      const null_push = (
        await pool.query(`SELECT null_deices_push FROM users WHERE id = $1`, [
          null_device.user_id,
        ])
      ).rows[0];
      if (!null_push) continue;

      if (null_push.null_deices_push == false) {
        console.log(null_device.user_id);

        const tg_id = (
          await pool.query(`SELECT telegram_id FROM users WHERE id = $1`, [
            null_device.user_id,
          ])
        ).rows[0].telegram_id;
        try {
          await bot.sendMessage(
            tg_id,
            "Уважаемый пользователь, видим, что вы создали устройство, но не используете его. Если у вас возникли трудности по настройке или какие-то ещё проблемы, то напишите нам @VPN_Support_SF , и мы обязательно поможем вам"
          );
        } catch (e) {
          console.log(e);
        }
        await pool.query(
          `UPDATE users SET null_deices_push  = true WHERE id = $1`,
          [null_device.user_id]
        );
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
