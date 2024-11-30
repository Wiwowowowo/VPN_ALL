process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

function randomInteger(min, max) {
  let rand = min + Math.random() * (max + 1 - min);
  return Math.floor(rand);
}

const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

let lastToken = {};

const Request = require("request");

const request = (params, resolve, reject) => {
  return new Promise((resolve, reject) => {
    Request(params, (err, response, body) => {
      if (!err) {
        resolve(body);
      } else {
        reject(err);
      }
    });
  });
};

const getCookie = async (server_id, server_ip, server_port, server_key) => {
  if (!lastToken[server_id] || lastToken[server_id] + 60000 < Date.now()) {
    await request({
      url: `https://${server_ip}:${server_port}/${server_key}/login`,
      method: "POST",
      form: {
        username: "admin",
        password: "admin",
      },
      jar: true,
      timeout: 10000,
    });

    lastToken[server_id] = Date.now();
  }
};

const createdKeys = () => {
  (async () => {
    const servers = (await pool.query(`select * from servers`)).rows;

    const mapServers = {};

    servers.forEach((el) => {
      if (!mapServers[el.country_id]) mapServers[el.country_id] = [];

      mapServers[el.country_id].push(el);
    });

    const needInsert = (
      await pool.query(
        `select devices.* from devices inner join users on users.id = devices.user_id left join devices_servers on devices.id = devices_servers.device_id and devices_servers.is_active = true where devices_servers.device_id is null and devices.is_active = true and devices.uuid is not null;`
      )
    ).rows;

    if (needInsert.length > 0) {
      console.log(needInsert);
    }

    for (const device of needInsert) {
      if (mapServers[device.country_id]) {
        const server =
          mapServers[device.country_id][
            randomInteger(0, mapServers[device.country_id].length - 1)
          ];

        await getCookie(server.id, server.ip, server.port, server.key);

        const data = await request({
          url: `https://${server.ip}:${server.port}/${server.key}/panel/inbound/addClient`,
          method: "POST",
          jar: true,
          timeout: 10000,
          form: {
            id: 1,
            settings: JSON.stringify({
              clients: [
                {
                  id: device.uuid,
                  flow: "",
                  email: device.uuid,
                  limitIp: 2,
                  totalGB: 0,
                  expiryTime: 0,
                  enable: true,
                  tgId: "",
                  subId: device.vpn_key,
                  reset: 0,
                },
              ],
            }),
          },
          json: true,
        });

        console.log(data, device.uuid);

        if (
          data &&
          ((data.success && (data.msg || "").match(/added Successfully/)) ||
            (data.msg || "").match(/Duplicate email/))
        ) {
          await pool.query(
            `INSERT INTO devices_servers (device_id, server_id) VALUES ($1, $2)`,
            [device.id, server.id]
          );
        }
      }
    }

    setTimeout(createdKeys, 1000);
  })().catch((e) => {
    console.log(e);

    setTimeout(createdKeys, 1000);
  });
};

createdKeys();

const deletedKeys = () => {
  (async () => {
    const rows = (
      await pool.query(`

            SELECT * FROM (select 
                (remote_active = FALSE AND created_remote = TRUE AND NOT (last_succes_daily = FALSE OR devices.is_active = FALSE OR devices_servers.is_active = FALSE)) as need_enable,
                (remote_active = TRUE AND created_remote = TRUE AND (last_succes_daily = FALSE OR devices.is_active = FALSE OR devices_servers.is_active = FALSE)) as need_disable,
                (created_remote = TRUE AND (devices.is_active = FALSE OR devices_servers.is_active = FALSE OR users.id IS NULL)) as need_deleted,  
                devices_servers.id, 
                devices_servers.device_id, 
                devices_servers.is_active as devices_servers_is_active, 
                devices_servers.remote_active, 
                users.last_succes_daily, 
                devices.is_active as devices_is_active,
                devices_servers.created_remote,
                devices.uuid,
                servers.ip as server_ip,
                servers.port as server_port,
                servers.key as server_key,
                servers.id as server_id,
                devices.vpn_key
            from devices_servers 
                inner join devices on devices.id = devices_servers.device_id 
                left join users on users.id = devices.user_id 
                inner join servers on servers.id = devices_servers.server_id) as t1 WHERE t1.need_disable = TRUE OR t1.need_deleted = TRUE OR t1.need_enable = TRUE`)
    ).rows;

    //console.log(rows);

    for (const row of rows) {
      if (row.need_deleted) {
        await getCookie(
          row.server_id,
          row.server_ip,
          row.server_port,
          row.server_key
        );

        console.log(
          `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/1/delClient/${row.uuid}`
        );

        const data = await request({
          url: `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/1/delClient/${row.uuid}`,
          method: "POST",
          jar: true,
          timeout: 10000,
          json: true,
        });

        if (data && data.success) {
          await pool.query(
            `UPDATE devices_servers SET created_remote = FALSE WHERE id = $1`,
            [row.id]
          );
        }
      } else if (row.need_disable) {
        await getCookie(
          row.server_id,
          row.server_ip,
          row.server_port,
          row.server_key
        );

        console.log(
          "need_disable",
          `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/updateClient/${row.uuid}`
        );

        const data = await request({
          url: `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/updateClient/${row.uuid}`,
          method: "POST",
          jar: true,
          timeout: 10000,
          json: true,
          form: {
            id: 1,
            settings: JSON.stringify({
              clients: [
                {
                  id: row.uuid,
                  flow: "",
                  email: row.uuid,
                  limitIp: 2,
                  totalGB: 0,
                  expiryTime: 0,
                  enable: false,
                  tgId: "",
                  subId: row.vpn_key,
                  reset: 0,
                },
              ],
            }),
          },
        });

        console.log(data);

        if (data && (data.success || data.msg.match(/empty client ID/))) {
          await pool.query(
            `UPDATE devices_servers SET remote_active = FALSE WHERE id = $1`,
            [row.id]
          );
        }
      } else if (row.need_enable) {
        await getCookie(
          row.server_id,
          row.server_ip,
          row.server_port,
          row.server_key
        );

        console.log(
          "need_enable",
          `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/updateClient/${row.uuid}`
        );

        const data = await request({
          url: `https://${row.server_ip}:${row.server_port}/${row.server_key}/panel/inbound/updateClient/${row.uuid}`,
          method: "POST",
          jar: true,
          timeout: 10000,
          json: true,
          form: {
            id: 1,
            settings: JSON.stringify({
              clients: [
                {
                  id: row.uuid,
                  flow: "",
                  email: row.uuid,
                  limitIp: 2,
                  totalGB: 0,
                  expiryTime: 0,
                  enable: true,
                  tgId: "",
                  subId: row.vpn_key,
                  reset: 0,
                },
              ],
            }),
          },
        });

        if (data && data.success) {
          await pool.query(
            `UPDATE devices_servers SET remote_active = TRUE WHERE id = $1`,
            [row.id]
          );
        }
      }
    }

    setTimeout(deletedKeys, 1000);
  })().catch((e) => {
    console.log(e);

    setTimeout(deletedKeys, 1000);
  });
};

deletedKeys();

const TelegramApi = require("node-telegram-bot-api");

const token = "8140863559:AAH0kEwnOe01gAJ0vml96UR9PB7Ku9tBmp8";

const bot = new TelegramApi(token, { polling: false });

const useTraffic = () => {
  (async () => {
    const servers = (await pool.query(`select * from servers`)).rows;

    for (const server of servers) {
      const connections = (
        await pool.query(
          `SELECT devices_servers.is_online, devices_servers.id, devices.name as device_name, devices.uuid, users.name, devices.user_id FROM devices_servers INNER JOIN devices ON devices.id = devices_servers.device_id INNER JOIN users ON users.id = devices.user_id WHERE created_remote = TRUE AND server_id = $1 AND uuid IS NOT NULL`,
          [server.id]
        )
      ).rows;

      const mapConnections = {};

      connections.forEach((connection) => {
        mapConnections[connection.uuid] = connection;
      });

      //console.log(mapConnections);

      await getCookie(server.id, server.ip, server.port, server.key);

      const clients = await request({
        url: `https://${server.ip}:${server.port}/${server.key}/panel/inbound/list`,
        jar: true,
        method: "POST",
        json: true,
      });

      const onlines = await request({
        url: `https://${server.ip}:${server.port}/${server.key}/panel/inbound/onlines`,
        jar: true,
        method: "POST",
        json: true,
      });

      //console.log(onlines);

      const mapOnlines = {};

      ((onlines && onlines.obj) || []).forEach((online) => {
        mapOnlines[online] = true;
      });

      for (const client of clients.obj[0].clientStats) {
        const uuid = client.email;

        const traffic = client.up + client.down;

        const online = mapOnlines[uuid] || false;

        if (mapConnections[uuid]) {
          await pool.query(
            `UPDATE devices_servers SET is_online = $1, use_traffic = $2 WHERE id = $3`,
            [online, traffic, mapConnections[uuid].id]
          );

          if (mapConnections[uuid].is_online !== online) {
            /*[290812301].forEach(el => {
                            bot.sendMessage(el, `Изменился онлайн у ${mapConnections[uuid].name} (ID: ${mapConnections[uuid].user_id}) (устройство: ${mapConnections[uuid].device_name}) на ${online ? 'Онлайн' : 'Оффлайн'}`)
                        })*/
            //console.log(uuid, mapConnections[uuid].name, online);
          }
        }
      }
    }

    //console.log('finish');

    setTimeout(useTraffic, 5000);
  })().catch((e) => {
    console.log(e);

    setTimeout(useTraffic, 5000);
  });
};

//useTraffic();
