const moment = require("moment");

moment.locale("ru");

const pg = require("pg");
const axios = require("axios");

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

const bot = new TelegramApi(token, {
  polling: true,
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
const peyOptions = (link) => {
  return {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [
          {
            text: "Оплатить",
            url: `${link}`,
          },
        ],
      ],
    }),
  };
};

const AutoPayOffOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Отключить автосписание",
          callback_data: "Off_autopay",
        },
      ],
    ],
  }),
};
const AutoPayOnOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Подключить автосписание",
          callback_data: "On_autopay",
        },
      ],
    ],
  }),
};
const confirmOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Подтвердить",
          callback_data: "confirm",
        },
        {
          text: "Отменить",
          callback_data: "mygatget",
        },
      ],
    ],
  }),
};

const settingofertaOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Оферта",
          url: "https://docs.google.com/document/d/1wxnnzeUrpUyhsKVZ5HG02y-e7a_KadmNaSDZrOujMDU/edit?usp=sharing",
        },
      ],
    ],
  }),
};
const mygadgetOptions = {
  reply_markup: JSON.stringify({
    inline_keyboard: [
      [
        {
          text: "Мои устройства",
          callback_data: "mygatget",
        },
      ],
    ],
  }),
};

bot.setMyCommands([
  {
    command: "/start",
    description: "Главное меню",
  },
  {
    command: "/buy",
    description: "Купить подписку",
  },
  {
    command: "/mygatget",
    description: "Мои устройства",
  },
  {
    command: "/support",
    description: "Поддержка",
  },
  {
    command: "/setting",
    description: "Настройки автосписания",
  },
  {
    command: "/oferta",
    description: "Оферта",
  },
]);

const validateEmail = (email) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};

function rightEnd(number, mas) {
  if (number > 10 && [11, 12, 13, 14].includes(number % 100)) return "дней";
  last_num = number % 10;
  if (last_num == 1) return mas[0];
  if ([2, 3, 4].includes(last_num)) return mas[1];
  if ([5, 6, 7, 8, 9, 0].includes(last_num)) return mas[2];
}

bot.on("message", (msg) => {
  (async () => {
    const r = /\d+/;
    const text = msg.text;
    const chatId = msg.chat.id;
    const name = msg.chat.first_name;

    if (text === "/start") {
      await pool.query(
        `insert into users (telegram_id, name, tg_username) values ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING;`,
        [msg.from.id, name, "@" + msg.from.username]
      );
      const user = (
        await pool.query(
          `SELECT first_enter, balance, id, first_marketing, id_user_invite, admission_ref FROM users WHERE telegram_id = $1`,
          [msg.from.id]
        )
      ).rows[0];
      if (user.first_enter == true) {
        const days_start = (
          await pool.query(
            ` SELECT t1.count as devices_count, CASE WHEN t1.count = 0 THEN 0 ELSE (balance / (t1.count * 5)) END AS days FROM users LEFT JOIN LATERAL (SELECT count(*) FROM devices WHERE devices.user_id = users.id AND is_active = true) as t1 on true WHERE users.telegram_id = $1; `,
            [msg.from.id]
          )
        ).rows[0].days;
        const how_gat = days_start.devices_count * 150;
        const howday = rightEnd(Math.floor(days_start), [
          "день",
          "дня",
          "дней",
        ]);
        await bot.sendMessage(chatId, `Рады вас снова видеть, ${name}`, {
          reply_markup: JSON.stringify({
            resize_keyboard: true,
            keyboard: [
              ["📱Мои устройства💻", "📅Мой баланс📅"],
              ["💵Пригласи друга💵"],
            ],
          }),
        });

        const gadget_how = rightEnd(days_start.devices_count, [
          "устройство",
          "устройства",
          "устройств",
        ]);
        if (days_start.devices_count > 0) {
          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} ₽. (~${Math.floor(days_start)}${howday})\n\nТариф ${how_gat} ₽/мес за ${days_start.devices_count} ${gadget_how}\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        } else {
          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} ₽. (~${Math.floor(user.balance / 5)}${howday})\n\nТариф 0 ₽/мес за 0 устройств\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        }
      } else {
        await bot.sendMessage(7457390746, `Зашел новый пользователь,${name}`);

        if (!user.first_marketing) {
          await pool.query(
            `UPDATE users SET balance = 35, last_succes_daily = $2, first_marketing = $2, first_enter = $2 WHERE telegram_id = $1`,
            [chatId, true]
          );
          await bot.sendMessage(chatId, `Добро пожаловать!`, {
            reply_markup: JSON.stringify({
              resize_keyboard: true,
              keyboard: [
                ["📱Мои устройства💻", "📅Мой баланс📅"],
                ["💵Пригласи друга💵"],
              ],
            }),
          });

          await bot.sendMessage(
            chatId,
            `Вам зачислено 35 рублей!\n\nПодключите VPN БЕСПЛАТНО. Пробный период на неделю. \n\n🚀Высокая скорость🚀\nРазные страны🇰🇿🇷🇺🇩🇪🇹🇷🇲🇨\n♾Отсутствие лимита трафика♾\n\n⬇️⬇️Нажмите кнопку⬇️⬇️`,
            {
              reply_markup: JSON.stringify({
                inline_keyboard: [
                  [
                    {
                      text: "Мои устройства",
                      callback_data: "mygatget",
                    },
                  ],
                ],
              }),
            }
          );
        }
        if (user.admission_ref == false && user.id_user_invite !== null) {
          await pool.query(
            `UPDATE users SET ref_balance = ref_balance + $1, balance = balance + $1, last_succes_daily = $3 WHERE id = $2`,
            [50, user.id_user_invite, true]
          );
          await pool.query(
            `UPDATE users SET balance = balance + $1, admission_ref = $3 WHERE telegram_id = $2`,
            [70, msg.from.id, true]
          );
          const telegram_ref_push = (
            await pool.query(`SELECT telegram_id FROM users WHERE id = $1`, [
              user.id_user_invite,
            ])
          ).rows[0].telegram_id;
          await bot.sendMessage(
            telegram_ref_push,
            `По вашей реферальной ссылке зарегистрировался пользователь, на баланс зачислено 50 рублей.`
          );
        }
      }
    } else if (text === "/buy") {
      const id_start = (
        await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [
          msg.from.id,
        ])
      ).rows[0].id;
      const how_many = (
        await pool.query(
          `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
          [id_start]
        )
      ).rows[0].count;
      const how_gat = how_many * 150;
      const gadget_how = rightEnd(how_many, [
        "устройство",
        "устройства",
        "устройств",
      ]);
      const send_by_month = [];
      if (how_many > 0) {
        send_by_month.push(
          [
            {
              text: `150 рублей(${Math.round((150 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "150",
            },
            {
              text: `300 рублей(${Math.round((300 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "300",
            },
          ],
          [
            {
              text: `450 рублей(${Math.round((450 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "450",
            },
            {
              text: `600 рублей(${Math.round((600 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "600",
            },
          ],
          [
            {
              text: `1000 ₽(бонус 500 ₽)(${Math.round((1500 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "1000",
            },
          ],
          [
            {
              text: `1500 ₽(бонус 1000 ₽)(${Math.round((2550 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "1500",
            },
          ]
        );
      } else {
        send_by_month.push(
          [
            {
              text: `150 рублей(1 мес)`,
              callback_data: "150",
            },
            {
              text: `300 рублей(2 мес)`,
              callback_data: "300",
            },
          ],
          [
            {
              text: `450 рублей(3 мес)`,
              callback_data: "450",
            },
            {
              text: `600 рублей(4 мес)`,
              callback_data: "600",
            },
          ],
          [
            {
              text: `1000 ₽(бонус 500 ₽)(10 мес)`,
              callback_data: "1000",
            },
          ],
          [
            {
              text: `1500 ₽(бонус 1000 ₽)(16.7 мес)`,
              callback_data: "1500",
            },
          ]
        );
      }

      await bot.sendMessage(
        chatId,
        `Выберите сумму пополнения\n\n Тариф ${how_gat} ₽/мес за ${how_many} ${gadget_how}\n\n<b><i>За пополнение от 1000 рублей, зачисляем на баланс больше денежных средств</i></b>`,
        {
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [...send_by_month],
          }),
        }
      );
    } else if (text === "/setting") {
      const rec = (
        await pool.query(`SELECT reccurent FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].reccurent;
      if (rec === true) {
        await bot.sendMessage(
          chatId,
          "Автосписание: Подключено",
          AutoPayOffOptions
        );
      } else {
        await bot.sendMessage(
          chatId,
          "Автосписание: Отключено",
          AutoPayOnOptions
        );
      }
    } else if (text === "💵Пригласи друга💵") {
      const invite_id_bal = (
        await pool.query(
          `SELECT id, ref_balance FROM users WHERE telegram_id = $1`,
          [chatId]
        )
      ).rows[0];
      bot.sendMessage(
        chatId,
        `За каждого приглашенного друга будет поступать 50 рублей, а другу 70 рублей на баланс\n\nСколько вы заработали по реферальной системе: ${invite_id_bal.ref_balance} рублей\n\n Деньги зачисляться на ваш основной баланс автоматически\n\nСсылка для приглашения: https://t.me/fast_unlimited_vpn_bot?start=ref_${invite_id_bal.id}`
      );
    } else if (text.startsWith("/start") && text.includes("partner")) {
      const pattern = /^\/start\s?partner_(\w+)$/;
      const matches = text.match(pattern);

      const partner = matches[1];

      await pool.query(
        `insert into users (telegram_id, name, name_partner, tg_username) values ($1, $2, $3, $4) ON CONFLICT (telegram_id) DO NOTHING;`,
        [msg.from.id, name, partner, "@" + msg.from.username]
      );
      const user = (
        await pool.query(
          `SELECT first_enter, balance, id FROM users WHERE telegram_id = $1`,
          [msg.from.id]
        )
      ).rows[0];
      if (user.first_enter == true) {
        const days_start = (
          await pool.query(
            `SELECT CASE WHEN t1.count = 0 THEN 0 ELSE (balance / (t1.count * 5)) END AS days FROM users LEFT JOIN LATERAL (SELECT count(*) FROM devices WHERE devices.user_id = users.id AND is_active = true) as t1 on true WHERE users.telegram_id = $1;`,
            [msg.from.id]
          )
        ).rows[0].days;
        const how_many = (
          await pool.query(
            `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
            [user.id]
          )
        ).rows[0].count;
        if (how_many > 0) {
          const howday = rightEnd(Math.floor(days_start), [
            "день",
            "дня",
            "дней",
          ]);
          await bot.sendMessage(chatId, `Рады вас снова видеть, ${name}`);
          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} рублей (~${Math.floor(days_start)}${howday})\nТариф 150р/мес за 1 устройство (активно ${how_many} устройств)\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        } else {
          await bot.sendMessage(chatId, `Рады вас снова видеть, ${name}`);
          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} рублей (~ 5 дней)\nТариф 150р/мес за 1 устройство (активно 0 устройств)\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        }
      } else {
        await bot.sendMessage(7457390746, `Зашел новый пользователь,${name}`);

        await bot.sendMessage(chatId, `Добро пожаловать ${name}`, {
          reply_markup: JSON.stringify({
            resize_keyboard: true,
            keyboard: [
              ["📱Мои устройства💻", "📅Мой баланс📅"],
              ["💵Пригласи друга💵"],
            ],
          }),
        });

        await pool.query(
          `UPDATE users SET balance = 35, last_succes_daily = $2, first_marketing = $2, first_enter = $2 WHERE telegram_id = $1`,
          [chatId, true]
        );

        await bot.sendMessage(
          chatId,
          `Вам зачислено 35 рублей!\n\nПодключите VPN БЕСПЛАТНО. Пробный период на неделю. \n\n🚀Высокая скорость🚀\nРазные страны🇰🇿🇷🇺🇩🇪🇹🇷🇲🇨\n♾Отсутствие лимита трафика♾\n\n⬇️⬇️Нажмите кнопку⬇️⬇️`,
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "🎉ХОЧУ БЕСПЛАТНО🎉",
                    callback_data: "confirm",
                  },
                ],
              ],
            }),
          }
        );
      }
    } else if (text === "📅Мой баланс📅") {
      const rec = (
        await pool.query(
          `SELECT balance, t1.count as devices_count, CASE WHEN t1.count = 0 THEN 0 ELSE (balance / (t1.count * 5)) END AS days FROM users LEFT JOIN LATERAL (SELECT count(*) FROM devices WHERE devices.user_id = users.id AND is_active = true) as t1 on true WHERE users.telegram_id = $1;`,
          [chatId]
        )
      ).rows[0];
      if (rec.devices_count > 0) {
        const howday = rightEnd(Math.floor(rec.days), ["день", "дня", "дней"]);

        const how_date = new Date(Date.now() + rec.days * 24 * 3600 * 1000);
        const date_how = moment(how_date).format("D MMM YYYY");
        await bot.sendMessage(
          chatId,
          `Ваш баланс ${Math.floor(rec.balance)} рублей (~${Math.floor(rec.days)} ${howday})\nПодписка активна до: ${date_how}`,
          mygadgetOptions
        );
      } else {
        await bot.sendMessage(
          chatId,
          `Ваш баланс ${Math.floor(rec.balance)} рублей. Активных устройст нет`,
          mygadgetOptions
        );
      }
    } else if (text.startsWith("/start") && text.match(r)) {
      const id_user_invite = text.replace(/\D/g, "");
      await pool.query(
        `INSERT INTO users (telegram_id, name, tg_username, id_user_invite) VALUES ($1, $2, $3, $4) ON CONFLICT (telegram_id) DO NOTHING;`,
        [msg.from.id, name, "@" + msg.from.username, id_user_invite]
      );
      const user = (
        await pool.query(
          `SELECT first_enter, id, balance, admission_ref FROM users WHERE telegram_id = $1`,
          [msg.from.id]
        )
      ).rows[0];
      if (user.first_enter == true) {
        const days_dev = (
          await pool.query(
            ` SELECT t1.count as devices_count, CASE WHEN t1.count = 0 THEN 0 ELSE (balance / (t1.count * 5)) END AS days FROM users LEFT JOIN LATERAL (SELECT count(*) FROM devices WHERE devices.user_id = users.id AND is_active = true) as t1 on true WHERE users.telegram_id = $1; `,
            [msg.from.id]
          )
        ).rows[0];
        const days_start = days_dev.days;
        if (days_dev.devices_count > 0) {
          const howday = rightEnd(Math.floor(days_start), [
            "день",
            "дня",
            "дней",
          ]);
          const how_gat = days_dev.devices_count * 150;
          await bot.sendMessage(chatId, `Рады вас снова видеть, ${name}`);
          const gadget_how = rightEnd(days_dev.devices_count, [
            "устройство",
            "устройства",
            "устройств",
          ]);

          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} ₽. (~${Math.floor(days_start)}${howday})\n\nТариф ${how_gat} ₽/мес за ${days_dev.devices_count} ${gadget_how}\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        } else {
          await bot.sendMessage(chatId, `Рады вас снова видеть, ${name}`);
          await bot.sendMessage(
            chatId,
            `Ваш баланс ${Math.floor(user.balance)} рублей (~ 5 дней)\nТариф 150р/мес за 1 устройство (активно 0 устройств)\n\nЕсли вы потеряли настройки - вы можете повторно их скачать, нажав на кнопку "Мои устройства".\n\n👭 Пригласите друзей в наш сервис и получите 30% от первого платежа на баланс за каждого друга `,
            tarifOptions
          );
        }
      } else {
        await bot.sendMessage(7457390746, `Зашел новый пользователь,${name}`);
        await pool.query(
          `UPDATE users SET balance = $1, last_succes_daily = $2, first_marketing = $2, first_enter = $2 WHERE telegram_id = $3`,
          [35, true, chatId]
        );
        await bot.sendMessage(chatId, `Добро пожаловать!`, {
          reply_markup: JSON.stringify({
            resize_keyboard: true,
            keyboard: [
              ["📱Мои устройства💻", "📅Мой баланс📅"],
              ["💵Пригласи друга💵"],
            ],
          }),
        });

        await bot.sendMessage(
          chatId,
          `Вам зачислено 105 рублей!\n\nПодключите VPN БЕСПЛАТНО. Пробный период на неделю. \n\n🚀Высокая скорость🚀\nРазные страны🇰🇿🇷🇺🇩🇪🇹🇷🇲🇨\n♾Отсутствие лимита трафика♾\n\n⬇️⬇️Нажмите кнопку⬇️⬇️`,
          {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "🎉ХОЧУ БЕСПЛАТНО🎉",
                    callback_data: "confirm",
                  },
                ],
              ],
            }),
          }
        );
      }
      if (user.admission_ref == false && id_user_invite !== null) {
        await pool.query(
          `UPDATE users SET ref_balance = ref_balance + $1, balance = balance + $1, last_succes_daily = $2 WHERE id = $3`,
          [50, true, id_user_invite]
        );
        await pool.query(
          `UPDATE users SET balance = balance + $1, admission_ref = $2 WHERE telegram_id = $3`,
          [70, true, msg.from.id]
        );
        const telegram_ref_push = (
          await pool.query(`SELECT telegram_id FROM users WHERE id = $1`, [
            id_user_invite,
          ])
        ).rows[0].telegram_id;
        await bot.sendMessage(
          telegram_ref_push,
          `По вашей реферальной ссылке зарегистрировался пользователь, на баланс зачислено 50 рублей.`
        );
      }
    } else if (text === "📱Мои устройства💻" || text === "/mygatget") {
      const add_id = (
        await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].id;
      const gadgets = (
        await pool.query(
          `SELECT id, name, is_active FROM devices WHERE user_id = $1 order by id`,
          [add_id]
        )
      ).rows;
      const send_devices = [];
      for (const gadget of gadgets) {
        if (gadget.is_active == true) {
          send_devices.push([
            {
              text: `Устройство ${gadget.name}`,
              callback_data: `gadget_${gadget.id}`,
            },
          ]);
        }
      }
      await bot.sendMessage(chatId, `Ваши устройства`, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            ...send_devices,
            [
              {
                text: "Добавить устройство",
                callback_data: "Add",
              },
              {
                text: "Удалить устройство",
                callback_data: "Delete",
              },
            ],
          ],
        }),
      });
    } else if (text === "/support") {
      await bot.sendMessage(
        chatId,
        "Для получения помощи напишите: @VPN_Support_SF"
      );
    } else if (text === "/oferta") {
      await bot.sendMessage(
        chatId,
        `ИП Еремин В.В. ИНН 622908770712 Оферта:`,
        settingofertaOptions
      );
    } else if (msg.text) {
      if (GET_STORE_PARAM(chatId, "step") === "email") {
        if (validateEmail(msg.text)) {
          await pool.query(
            `UPDATE users SET email = $1 WHERE telegram_id = $2`,
            [msg.text.toLowerCase().trim(), chatId]
          );
          if (
            GET_STORE_PARAM(chatId, "pay_button") === "150" ||
            GET_STORE_PARAM(chatId, "pay_button") === "300" ||
            GET_STORE_PARAM(chatId, "pay_button") === "450" ||
            GET_STORE_PARAM(chatId, "pay_button") === "600" ||
            GET_STORE_PARAM(chatId, "pay_button") === "1000" ||
            GET_STORE_PARAM(chatId, "pay_button") === "1500"
          ) {
            const link = await createPaymentUrl(
              msg.text.toLowerCase().trim(),
              +GET_STORE_PARAM(chatId, "pay_button"),
              chatId
            );
            await bot.sendMessage(
              chatId,
              `Депозит ${GET_STORE_PARAM(chatId, "pay_button")} рублей\n\nПроблема с оплатой? @VPN_Support_SF\r\n\r\nДля оплаты нажмите на кнопку ниже`,
              peyOptions(link)
            );
          }
        } else {
          await bot.sendMessage(chatId, "Введите корректный email");
        }
      }
    }
  })().catch((e) => {
    console.log(e);

    bot.sendMessage(msg.chat.id, "Произошла какая-то ошибка, повторите запрос");
  });
});

const STORE = {};
const ADD_STORE_PARAM = (chatId, key, value) => {
  if (!STORE[chatId]) STORE[chatId] = {};
  STORE[chatId][key] = value;
};

const GET_STORE_PARAM = (chatId, key) => {
  if (!STORE[chatId]) return undefined;
  return STORE[chatId][key];
};

const createPaymentUrl = async (email, value, chatId, is_trial) => {
  const data = await axios.post(
    "https://api.yookassa.ru/v3/payments",
    {
      amount: {
        value: value,
        currency: "RUB",
      },
      payment_method_data: {
        type: "bank_card",
      },
      confirmation: {
        type: "redirect",
        return_url: "https://www.example.com/return_url",
      },
      description: "информационные услуги",
      capture: is_trial ? false : true,
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
  const payid = data.data.id;
  const user_id = (
    await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [chatId])
  ).rows[0].id;
  await pool.query(
    `INSERT into payment (user_id, id_billing, amount) values($1, $2, $3)`,
    [user_id, payid, data.data.amount.value]
  );
  await bot.sendMessage(
    7457390746,
    `Пользователь ${user_id} хочет купить на ${data.data.amount.value}`
  );
  return data.data.confirmation.confirmation_url;
};

function generateUUID() {
  var d = new Date().getTime();
  var d2 =
    (typeof performance !== "undefined" &&
      performance.now &&
      performance.now() * 1000) ||
    0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

bot.on("callback_query", (cb) => {
  (async () => {
    await bot.answerCallbackQuery(cb.id);
    const chatId = cb.from.id;
    const uuid = generateUUID();
    if (cb.data === "1") {
      const id_start = (
        await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].id;
      const how_many = (
        await pool.query(
          `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
          [id_start]
        )
      ).rows[0].count;
      const how_gat = how_many * 150;
      const gadget_how = rightEnd(Math.floor(how_many), [
        "устройство",
        "устройства",
        "устройств",
      ]);
      const send_by_month = [];
      if (how_many > 0) {
        send_by_month.push(
          [
            {
              text: `150 рублей(${Math.round((150 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "150",
            },
            {
              text: `300 рублей(${Math.round((300 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "300",
            },
          ],
          [
            {
              text: `450 рублей(${Math.round((450 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "450",
            },
            {
              text: `600 рублей(${Math.round((600 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "600",
            },
          ],
          [
            {
              text: `1000 ₽(бонус 500 ₽)(${Math.round((1500 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "1000",
            },
          ],
          [
            {
              text: `1500 ₽(бонус 1050 ₽)(${Math.round((2500 / (how_many * 150)) * 10) / 10}мес)`,
              callback_data: "1500",
            },
          ]
        );
      } else {
        send_by_month.push(
          [
            {
              text: `150 рублей(1 мес)`,
              callback_data: "150",
            },
            {
              text: `300 рублей(2 мес)`,
              callback_data: "300",
            },
          ],
          [
            {
              text: `450 рублей(3 мес)`,
              callback_data: "450",
            },
            {
              text: `600 рублей(4 мес)`,
              callback_data: "600",
            },
          ],
          [
            {
              text: `1000 ₽(бонус 500 ₽)(10 мес)`,
              callback_data: "1000",
            },
          ],
          [
            {
              text: `1500 ₽(бонус 1000 ₽)(16.7 мес)`,
              callback_data: "1500",
            },
          ]
        );
      }
      await bot.sendMessage(
        chatId,
        `Выберите сумму пополнения\n\n Тариф ${how_gat} ₽/мес за ${how_many} ${gadget_how}\n\n<b><i>За пополнение от 1000 рублей, зачисляем на баланс больше денежных средств</i></b>`,
        {
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [...send_by_month],
          }),
        }
      );
    } else if (
      cb.data === "150" ||
      cb.data === "300" ||
      cb.data === "450" ||
      cb.data === "600" ||
      cb.data === "1000" ||
      cb.data === "1500"
    ) {
      const email = (
        await pool.query(`SELECT email FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].email;
      const amount = +cb.data;

      if (email === null) {
        ADD_STORE_PARAM(chatId, "step", "email");
        ADD_STORE_PARAM(chatId, "pay_button", cb.data);

        await bot.sendMessage(chatId, `Введи email для оплаты:`);
      } else {
        const link = await createPaymentUrl(email, +cb.data, chatId);
        await bot.sendMessage(
          chatId,
          `Депозит ${amount} рублей\n\nПроблема с оплатой? @VPN_Support_SF\r\n\r\nДля оплаты нажмите на кнопку ниже`,
          peyOptions(link)
        );
      }
    }
    if (cb.data === "Off_autopay") {
      pool.query(
        `UPDATE users SET reccurent = 'false' WHERE telegram_id = $1`,
        [chatId]
      ).reccurent;
      bot.sendMessage(chatId, "Автосписание отключено");
    }

    if (cb.data === "On_autopay") {
      pool.query(`UPDATE users SET reccurent = 'true' WHERE telegram_id = $1`, [
        chatId,
      ]).reccurent;
      bot.sendMessage(chatId, "Автосписание подключено");
    }
    if (cb.data === "Add") {
      await bot.sendMessage(
        chatId,
        "Вы хотите добавить ещё 1 устройство\n\nЗа него будет списываться дополнительная плата 150 рублей в месяц",
        confirmOptions
      );
    }
    if (cb.data === "confirm") {
      const add_id_bal = (
        await pool.query(
          `SELECT id, balance FROM users WHERE telegram_id = $1`,
          [chatId]
        )
      ).rows[0];
      const how_many = (
        await pool.query(
          `SELECT COUNT(*) FROM devices WHERE user_id = $1 and is_active = true`,
          [add_id_bal.id]
        )
      ).rows[0].count;
      if (add_id_bal.balance > 0) {
        if (how_many >= 5) {
          await bot.sendMessage(
            chatId,
            "Добавлено максимальное количество устройств"
          );
        } else {
          let vpn_key_id = Math.random().toString(32).slice(2);

          const randomcountry = (
            await pool.query(
              `select id, description from countries order by random() limit 1`
            )
          ).rows[0];

          await pool.query(
            `INSERT INTO devices (user_id, created_at, vpn_key, country_id, uuid) values ($1, $2, $3, $4, $5)`,
            [
              add_id_bal.id,
              new Date().toISOString(),
              vpn_key_id,
              randomcountry.id,
              uuid,
            ]
          );
          const vpn_id = (
            await pool.query(`SELECT id FROM devices WHERE vpn_key = $1`, [
              vpn_key_id,
            ])
          ).rows[0].id;
          const VPNOptions = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [
                  {
                    text: "🤖Android🤖",
                    callback_data: `VPN${vpn_id}Android`,
                  },
                  {
                    text: "🍎IOS🍎",
                    callback_data: `VPN${vpn_id}Apple`,
                  },
                ],
                [
                  {
                    text: "🪟Windows🪟",
                    callback_data: `VPN${vpn_id}Windows`,
                  },
                  {
                    text: "🍏MacOS🍏",
                    callback_data: `VPN${vpn_id}MacOS`,
                  },
                ],
              ],
            }),
          };
          await bot.sendMessage(
            chatId,
            "Устройство добавлено. Выберите вашу операционную систему",
            VPNOptions
          );

          await bot.sendMessage(
            7457390746,
            `Чел ID: ${add_id_bal.id} добавил устройство`
          );
        }
      } else {
        await bot.sendMessage(
          chatId,
          "У вас недостаточно денежных средств на балансе, чтобы добавить устройство. Пополнить /buy"
        );
      }
    }
    if (cb.data === "mygatget") {
      const add_id = (
        await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].id;
      const gadgets = (
        await pool.query(
          `SELECT id, name, is_active FROM devices WHERE user_id = $1`,
          [add_id]
        )
      ).rows;
      const send_devices = [];

      for (const gadget of gadgets) {
        if (gadget.is_active == true) {
          send_devices.push([
            {
              text: `Устройство ${gadget.name}`,
              callback_data: `gadget_${gadget.id}`,
            },
          ]);
        }
      }
      await bot.sendMessage(chatId, `Ваши устройства`, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            ...send_devices,
            [
              {
                text: "Добавить устройство",
                callback_data: "Add",
              },
              {
                text: "Удалить устройство",
                callback_data: "Delete",
              },
            ],
          ],
        }),
      });
    }
    if (cb.data === "Delete") {
      const add_id = (
        await pool.query(`SELECT id FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].id;
      const gadgets = (
        await pool.query(
          `SELECT id, name, is_active FROM devices WHERE user_id = $1`,
          [add_id]
        )
      ).rows;
      const send_devices = [];
      for (const gadget of gadgets) {
        if (gadget.is_active == true) {
          send_devices.push([
            {
              text: `Удалить устройство ${gadget.name}?`,
              callback_data: `deletegadget_${gadget.id}`,
            },
          ]);
        }
      }

      const deleteOptions = {
        reply_markup: JSON.stringify({
          inline_keyboard: send_devices,
        }),
      };

      await bot.sendMessage(chatId, `Ваши устройства`, deleteOptions);
    }
    if (cb.data.startsWith("gadget_")) {
      const id_device = cb.data.replace(/\D/g, "");
      const country_id = (
        await pool.query(`SELECT country_id FROM devices WHERE id = $1`, [
          id_device,
        ])
      ).rows[0].country_id;
      const name_country = (
        await pool.query(`SELECT description FROM countries WHERE id = $1`, [
          country_id,
        ])
      ).rows[0].description;

      const PNOptions = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Изменить страну",
                callback_data: `changecountry${id_device}`,
              },
            ],
            [
              {
                text: "🤖Android🤖",
                callback_data: `VPN${id_device}Android`,
              },
              {
                text: "🍎IOS🍎",
                callback_data: `VPN${id_device}Apple`,
              },
            ],
            [
              {
                text: "🪟Windows🪟",
                callback_data: `VPN${id_device}Windows`,
              },
              {
                text: "🍏MacOS🍏",
                callback_data: `VPN${id_device}MacOS`,
              },
            ],
          ],
        }),
      };
      await bot.sendMessage(
        chatId,
        `Вы подключены к стране: ${name_country}\n\nВозникли проблемы? Напишите нам: @VPN_Support_SF\n\nНужна инструкция по настройке?`,
        PNOptions
      );
    }
    if (cb.data.startsWith("changecountry")) {
      const country_device = cb.data.replace(/\D/g, "");
      const countries = (
        await pool.query(`SELECT id, description FROM countries`)
      ).rows;
      const change_countries = [];
      for (const country of countries) {
        change_countries.push([
          {
            text: `${country.description}`,
            callback_data: `change-country-${country_device}-${country.id}`,
          },
        ]);
      }
      const CountryOptions = {
        reply_markup: JSON.stringify({
          inline_keyboard: change_countries,
        }),
      };
      await bot.sendMessage(
        chatId,
        "Выберите страну, после подтверждения смены, страна изменится в течение 10 минут",
        CountryOptions
      );
    }
    if (cb.data.startsWith(`change-country-`)) {
      const iddel_device = cb.data.match(/change\-country\-(\d+)\-(\d+)/);

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        await client.query(`SELECT id FROM devices WHERE id = $1 FOR UPDATE;`, [
          iddel_device[1],
        ]);

        const currentCountry = (
          await client.query(`SELECT country_id FROM devices WHERE id = $1`, [
            iddel_device[1],
          ])
        ).rows[0].country_id;

        if (+currentCountry !== +iddel_device[2]) {
          await client.query(
            `UPDATE devices SET country_id = $1 WHERE id = $2`,
            [iddel_device[2], iddel_device[1]]
          );
          await client.query(
            `UPDATE devices_servers SET need_delete = now() WHERE device_id = $1`,
            [iddel_device[1]]
          );
        }

        await client.query("COMMIT");

        const country_name = (
          await pool.query(`SELECT description FROM countries WHERE id = $1`, [
            iddel_device[2],
          ])
        ).rows[0].description;

        await bot.sendMessage(chatId, `Страна изменена на: ${country_name}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    if (cb.data.startsWith("deletegadget_")) {
      const iddel_device = cb.data.replace(/\D/g, "");
      const name_dev = (
        await pool.query(`SELECT name from devices WHERE id = $1`, [
          iddel_device,
        ])
      ).rows[0].name;
      const deleteOptions = {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              {
                text: "Удалить устройство",
                callback_data: `delgad${iddel_device}`,
              },
              {
                text: "Отменить удаление",
                callback_data: "mygatget",
              },
            ],
          ],
        }),
      };
      await bot.sendMessage(
        chatId,
        `Вы точно хотите удалить устройство ${name_dev}?`,
        deleteOptions
      );
    }
    if (cb.data.startsWith("delgad")) {
      const iddelete_device = cb.data.replace(/\D/g, "");
      const create_at_day = (
        await pool.query(`SELECT created_at FROM devices WHERE id = $1`, [
          iddelete_device,
        ])
      ).rows[0].created_at;
      if (create_at_day < Date.now() - 1 * 24 * 3600 * 1000) {
        await pool.query(`update devices set is_active = false where id = $1`, [
          iddelete_device,
        ]);
        await bot.sendMessage(chatId, `Устройство удалено`);
      } else {
        await bot.sendMessage(
          chatId,
          "С момента создания устройства прошло менее 24 часов, удалить устройство невозможно"
        );
      }
    }
    if (
      (cb.data.startsWith("VPN") && cb.data.endsWith("Android")) ||
      (cb.data.startsWith("VPN") && cb.data.endsWith("Apple")) ||
      (cb.data.startsWith("VPN") && cb.data.endsWith("Windows")) ||
      (cb.data.startsWith("VPN") && cb.data.endsWith("MacOS"))
    ) {
      const iddel_devicevpn = cb.data.replace(/\D/g, "");
      const vpn_connect = (
        await pool.query(
          `SELECT vpn_key, uuid, flow FROM devices WHERE id = $1`,
          [iddel_devicevpn]
        )
      ).rows[0];
      if (cb.data.endsWith("Android")) {
        await pool.query(
          `UPDATE devices SET name = 'Apple IOS' WHERE vpn_key = $1`,
          [vpn_connect.vpn_key]
        );
        await bot.sendMessage(
          chatId,
          `1. Скачайте и установите приложение <a href="https://play.google.com/store/apps/details?id=com.v2raytun.android&hl=uk&gl=US">V2RayTune из GooglePlay</a>\n2. Нажмите на ссылку снизу и вставьте в приложение V2RayTune: нажмите ➕ вверху, и затем Добавить из буфера. \n4. Готово! Чтобы пользоваться VPN нажмите подключить/отключить в приложении или в настройках`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        );
      } else if (cb.data.endsWith("Apple")) {
        await pool.query(
          `UPDATE devices SET name = 'Apple IOS' WHERE vpn_key = $1`,
          [vpn_connect.vpn_key]
        );
        await bot.sendMessage(
          chatId,
          `1. Скачайте и установите приложение <a href="https://apps.apple.com/ru/app/v2raytun/id6476628951">V2RayTune из AppStore</a>\n2. Нажмите на текст-ссылку снизу и вставьте в приложение V2RayTune: нажмите на ➕, и затем Добавить из буфера. \n4. Готово! Чтобы пользоваться VPN нажмите значок плей в приложении или в настройках`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        );
      } else if (cb.data.endsWith("Windows")) {
        await pool.query(
          `UPDATE devices SET name = 'Windows' WHERE vpn_key = $1`,
          [vpn_connect.vpn_key]
        );
        await bot.sendMessage(
          chatId,
          `1. Скачайте и установите приложение <a href="https://www.microsoft.com/store/productId/9PDFNL3QV2S5?ocid=pdpshare">Hiddify из MicrosortStore</a>\n2. Нажмите на ссылку снизу и вставьте в приложение Hiddify: нажмите "Новый профиль", затем "Добавить из буфера обмена". \n3. Готово! Чтобы пользоваться VPN нажмите на логотип в приложении`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        );
      } else if (cb.data.endsWith("MacOS")) {
        await pool.query(
          `UPDATE devices SET name = 'Apple MacOS' WHERE vpn_key = $1`,
          [vpn_connect.vpn_key]
        );
        await bot.sendMessage(
          chatId,
          `1. Скачайте и установите приложение <a href="https://apps.apple.com/ru/app/v2raytun/id6476628951">V2RayTune из AppStore</a>\n2. Нажмите на ссылку снизу и вставьте в приложение V2RayTune: нажмите ➕ вверху, и затем Добавить из буфера. \n3. Готово! Чтобы пользоваться VPN нажмите подключить/отключить в приложении или в настройках`,
          {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }
        );
      }
      if (vpn_connect.flow == false) {
        await bot.sendMessage(
          chatId,
          `<code>vless://${vpn_connect.uuid}@${vpn_connect.vpn_key}.secure-fast.pro:443?type=tcp&security=reality&pbk=SkALkcGApM-rT9deLcrchgUaxUDQfwfLwgLyd687bn8&fp=random&sni=google.com&sid=23cd&spx=%2F#valera-vpn</code>`,
          {
            parse_mode: "HTML",
          }
        );
      } else {
        await bot.sendMessage(
          chatId,
          `<code>vless://${vpn_connect.uuid}@${vpn_connect.vpn_key}.secure-fast.pro:443?type=tcp&security=reality&pbk=SkALkcGApM-rT9deLcrchgUaxUDQfwfLwgLyd687bn8&fp=chrome&sni=google.com&sid=23cd&spx=%2F&flow=xtls-rprx-vision#valera-vpn</code>`,
          {
            parse_mode: "HTML",
          }
        );
      }
    }
    if (cb.data == "connectVPN") {
      const email = (
        await pool.query(`SELECT email FROM users WHERE telegram_id = $1`, [
          chatId,
        ])
      ).rows[0].email;

      if (email === null) {
        ADD_STORE_PARAM(chatId, "step", "email");
        await bot.sendMessage(
          chatId,
          `Введите email для активации пробного периода:`
        );
        ADD_STORE_PARAM(chatId, "pay_button", 1);
      } else {
        const link = await createPaymentUrl(email, 1, chatId);
        await bot.sendMessage(
          chatId,
          `Пробный период на 1 неделю за 1 рубль\n\nДля оплаты нажмите на кнопку ниже`,
          peyOptions(link)
        );
      }
    }
  })().catch((e) => {
    console.log(e);

    bot.sendMessage(cb.from.id, "Произошла неизвестная ошибка");
  });
});
