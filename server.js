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

      // Get the current date
      const t = moment();
      // Find the next Saturday and Sunday
      const saturday = t.clone().isoWeekday(6).format("D MMMM YYYY");
      const sunday = t.clone().isoWeekday(7).format("D MMMM YYYY");

      let allWeek = [];
      for (let i = 1; i <= 7; i++) {
        const weekDay = t.clone().isoWeekday(i);
        allWeekEvenings.push(weekDay.format("D MMMM YYYY"));
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
            const comparisonTime = moment("18:00", "HH:mm", true);
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

    case "/weekend_spectacles":
      const responseWeekend = await scrapeTheaterEvents("weekend");
      if (typeof responseWeekend === "string") {
        bot.sendMessage(chatId, response);
        break;
      }
      for (const event of responseWeekend) {
        await sendMessageWithDelay(event, chatId, 200);
      }
      break;

    case "/all_week_evenings_spectacles":
      const responseAllWeekEvenings = await scrapeTheaterEvents(
        "all_week_evenings"
      );
      if (typeof responseAllWeekEvenings === "string") {
        bot.sendMessage(chatId, response);
        break;
      }
      for (const event of responseAllWeekEvenings) {
        await sendMessageWithDelay(event, chatId, 200);
      }
      break;
    default:
      // Handle unknown commands or messages
      bot.sendMessage(chatId, "Unknown command. Please try again.");
      break;
  }
});
