const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const moment = require("moment");
const TelegramBot = require("node-telegram-bot-api");

moment.locale("ru");
const app = express();
require("dotenv").config();

const PORT = 3333;
const DELAY_BETWEEN_MESSAGES = 200;
const EVENING_START_TIME = "18:00";
const FEST_URL = "https://www.fest.md/ru/events/performances";

const COMMANDS = [
  {
    command: "today_spectacles",
    description: "Afișează evenimentele de teatru de azi",
  },
  {
    command: "tomorrow_spectacles",
    description: "Afișează evenimentele de teatru de mâine",
  },
  {
    command: "weekend_spectacles",
    description: "Listează toate evenimentele de teatru din weekend",
  },
  {
    command: "all_week_evenings_spectacles",
    description:
      "Listează toate spectacolele de teatru din săptămână după ora 18:00",
  },
];

const scrapeTheaterEvents = async (day) => {
  try {
    const response = await axios.get(FEST_URL);
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

      const t = moment(); // today
      const today = moment().format("D MMMM YYYY");
      const tomorrow = moment().add(1, "day").format("D MMMM YYYY");
      const saturday = t.clone().isoWeekday(6).format("D MMMM YYYY");
      const sunday = t.clone().isoWeekday(7).format("D MMMM YYYY");
      const allWeek = [];

      for (let i = 1; i <= 7; i++) {
        const weekDay = t.clone().isoWeekday(i);
        allWeek.push(weekDay.format("D MMMM YYYY"));
      }
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
        if (day === "weekend") {
          const weekend = [saturday, sunday];
          return weekend.some((date) => event.date.includes(date));
        }
        if (day === "all_week_evenings") {
          return allWeek.some((date) => {
            const eventTime = moment(event.date.split(", ")[1], "HH:mm", true);
            const comparisonTime = moment(EVENING_START_TIME, "HH:mm", true);
            return (
              event.date.includes(date) &&
              eventTime.isSameOrAfter(comparisonTime)
            );
          });
        }
      });

      if (filteredEvents.length === 0) {
        return "Nu sunt evenimente disponibile";
      }

      const uniqueEvents = new Set(
        filteredEvents.map(
          (event) => `${event.date}\nhttps://www.fest.md${event.link}`
        )
      );

      // sort by date and time
      const sortedEvents = [...uniqueEvents].sort((a, b) => {
        const formatString = "DD MMMM YYYY, HH:mm";
        const timeA = moment(a, formatString);
        const timeB = moment(b, formatString);

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

const listener = app.listen(PORT, () => {
  console.log(`Aplicația este pornită pe portul ${listener.address().port}`);
});

const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: true });

bot.on("polling_error", (error) => {
  console.log("Polling error:", error.code, error.message);
});

// Set commands
bot
  .setMyCommands(COMMANDS)
  .then(() => console.log("Comenzile au fost setate cu succes"))
  .catch((error) => console.error(error));

async function handleCommand(chatId, day) {
  const response = await scrapeTheaterEvents(day);
  if (typeof response === "string") {
    bot.sendMessage(chatId, response);
  } else {
    for (const event of response) {
      await new Promise((resolve) => {
        setTimeout(() => {
          bot.sendMessage(chatId, event);
          resolve();
        }, DELAY_BETWEEN_MESSAGES);
      });
    }
  }
}

// Handle incoming messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  switch (msg.text) {
    case "/start":
      bot.sendMessage(chatId, "Bun venit!");
      break;
    case "/today_spectacles":
      handleCommand(chatId, "today");
      break;
    case "/tomorrow_spectacles":
      handleCommand(chatId, "tomorrow");
      break;
    case "/weekend_spectacles":
      handleCommand(chatId, "weekend");
      break;
    case "/all_week_evenings_spectacles":
      handleCommand(chatId, "all_week_evenings");
      break;
    default:
      // Handle unknown commands or messages
      bot.sendMessage(chatId, "Unknown command. Please try again.");
      break;
  }
});
