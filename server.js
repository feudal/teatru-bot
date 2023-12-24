const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment");
const TelegramBot = require("node-telegram-bot-api");

moment.locale("ru");
const app = express();
require("dotenv").config();

const port = 3333;
const festUrl = "https://www.fest.md/ru/events/performances";

const scrapeTheaterEvents = async (day) => {
  try {
    const response = await axios.get(festUrl);
    if (response.status === 200) {
      const html = response.data;
      const $ = cheerio.load(html);

      const eventBlocks = $(
        ".block-item.fixed-size.event-block.no-free-admission"
      );
      const events = [];

      eventBlocks.each((index, element) => {
        // const title = $(element).find(".title").text().trim();
        const date = $(element).find(".icon-calendar").next().text().trim();
        const link = $(element).find(".title").attr("href");
        events.push({ date: date.toLowerCase(), link });
      });

      const today = moment().format("D MMMM YYYY");
      const tomorrow = moment().add(1, "day").format("D MMMM YYYY");
      // const weekend = [
      //   moment().day("Saturday").format("D MMMM YYYY"),
      //   moment().day("Sunday").format("D MMMM YYYY"),
      // ];

      const onlyTheaterEvents = events.filter((event) =>
        event.link.includes("performances")
      );

      const filteredEvents = onlyTheaterEvents.filter((event, index) => {
        if (day === "today") {
          return event.date.includes(today);
        }
        if (day === "tomorrow") {
          return event.date.includes(tomorrow);
        }
        // if (day === "weekend") {
        //   return weekend.some((date) => event.date.includes(date));
        // }
      });

      if (filteredEvents.length === 0) {
        return "Nu sunt evenimente disponibile";
      }

      const uniqueEvents = new Set(
        filteredEvents.map(
          (event) => `${event.date}\nhttps://www.fest.md${event.link}`
        )
      );

      // sort by hour
      const sortedEvents = [...uniqueEvents].sort((a, b) => {
        const timeA = moment(a.split("\n")[0].split(", ")[1], "HH:mm", true);
        const timeB = moment(b.split("\n")[0].split(", ")[1], "HH:mm", true);

        return timeA - timeB;
      });

      return sortedEvents;
    }
    return "Eroare la preluarea datelor";
  } catch (error) {
    console.error("Eroare:", error);
    return "Eroare la preluarea datelor";
  }
};

app.get("/", (req, res) => {
  res.send("Botul funcționează");
});

const listener = app.listen(port, () => {
  console.log(`Aplicația este pornită pe portul ${listener.address().port}`);
});

const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.code, error.message);
});

// Set commands
const commands = [
  {
    command: "today_spectacles",
    description: "Afișează evenimentele de teatru de azi",
  },
  {
    command: "tomorrow_spectacles",
    description: "Afișează evenimentele de teatru de mâine",
  },
  // {
  //   command: "weekend_spectacles",
  //   description: "Listează toate evenimentele de teatru din weekend",
  // },
];

bot
  .setMyCommands(commands)
  .then(() => console.log("Comenzile au fost setate cu succes"))
  .catch((error) => console.error(error));

function sendMessageWithDelay(message, chatId, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      bot.sendMessage(chatId, message);
      resolve();
    }, delay);
  });
}

// Handle incoming messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  switch (msg.text) {
    case "/start":
      bot.sendMessage(chatId, "Bun venit! Alege o comandă:");
      break;

    case "/today_spectacles":
      const response = await scrapeTheaterEvents("today");
      if (typeof response === "string") {
        bot.sendMessage(chatId, response);
        break;
      }
      for (const event of response) {
        await sendMessageWithDelay(event, chatId, 200);
      }
      break;
    case "/tomorrow_spectacles":
      const responseTomorrow = await scrapeTheaterEvents("tomorrow");
      if (typeof responseTomorrow === "string") {
        bot.sendMessage(chatId, response);
        break;
      }
      for (const event of responseTomorrow) {
        await sendMessageWithDelay(event, chatId, 200);
      }
      break;

    // case "/week_spectacles":
    //   const responseWeekend = await scrapeTheaterEvents("weekend");
    //   responseWeekend.forEach((event) => {
    //     bot.sendMessage(chatId, event);
    //   });
    default:
      // Handle unknown commands or messages
      bot.sendMessage(chatId, "Unknown command. Please try again.");
      break;
  }
});
