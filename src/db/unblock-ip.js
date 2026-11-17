const ipLimit = require('../services/ipLimit');

const ip = process.argv[2];

if (ip) {
  console.log(ipLimit.unblock(ip) ? `Odblokowano adres ${ip}.` : `Adres ${ip} nie był zablokowany.`);
} else {
  console.log(`Wyczyszczono liczniki prób dla ${ipLimit.unblockAll()} adresów IP.`);
}
