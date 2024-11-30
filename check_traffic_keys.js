process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const axios = require("axios");

const pg = require("pg");

const pool = new pg.Pool({
  user: "postgres",
  password: "",
  database: "valeriy",
  host: "127.0.0.1",
  port: 5432,
  max: 20,
});

const main = () => {
  (async () => {
    const servers = (await pool.query(`SELECT * FROM servers`)).rows;

    for (const server of servers) {
      const data = await axios.get(
        `https://${server.ip}:${server.port}/${server.key}/access-keys`
      );
      const metrics = await axios.get(
        `https://${server.ip}:${server.port}/${server.key}/metrics/transfer`
      );

      const map = {};

      data.data.accessKeys.forEach((el) => {
        map[el.id] = el;
      });

      for (const id in metrics.data.bytesTransferredByUserId) {
        if (map[id]) map[id].bytes = metrics.data.bytesTransferredByUserId[id];
      }

      for (const id in map) {
        if (map[id].bytes) {
          await pool.query(
            `UPDATE devices_servers SET use_traffic = $1 WHERE server_password = $2 AND server_id = $3`,
            [map[id].bytes, map[id].password, server.id]
          );
        }
      }

      const keysInDatabase = (
        await pool.query(`SELECT * FROM devices_servers WHERE server_id = $1`, [
          server.id,
        ])
      ).rows;

      const map2 = {};

      keysInDatabase.forEach((el) => {
        map2[el.server_password] = true;
      });

      for (const inServerKey of data.data.accessKeys) {
        if (!map2[inServerKey.password]) {
          console.log(
            `DELETE: https://${server.ip}:${server.port}/${server.key}/access-keys/${inServerKey.id}`
          );

          const data = await axios.delete(
            `https://${server.ip}:${server.port}/${server.key}/access-keys/${inServerKey.id}`
          );
        }
      }
    }

    console.log("FINISH");

    setTimeout(main, 1000);
  })().catch((e) => {
    console.log(e);

    setTimeout(main, 1000);
  });
};

main();
