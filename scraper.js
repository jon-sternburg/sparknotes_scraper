const express = require("express");
const fsp = require("fs").promises;
const path = require("path");
const app = express();
const cheerio = require("cheerio");
const axios = require("axios");
const all_books = require("./all_book_data.json");
var Bottleneck = require("bottleneck/es5");
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 500,
});

app.use(express.static("public"));

/*

get_book_list - gets list of books from https://www.sparknotes.com/lit/
compare_book_list - compares sparknotes list to book reader list and writes list of matching books ready to scrape with href
get_quote_data - cycles through books_to_scrape.json to fetch quote data from all quote pages on sparknotes
get_scraped_list - compiles list of books with successfully scraped quote data
get_complete_list - compiles list of books with quotes found in text
*/

// gets list of books from https://www.sparknotes.com/lit/
async function get_book_list() {
  axios
    .get("https://www.sparknotes.com/lit/")
    .then((response) => {
      const $ = cheerio.load(response.data);
      const container_div = $(".hub-AZ-list");
      const parent_boxes = container_div.find("li");

      return Promise.all(
        parent_boxes.map((i, element) => {
          return new Promise((resolve, reject) => {
            const title_el = $(element)
              .find(".hub-AZ-list__card__title")
              .text();
            const author_el = $(element)
              .find(".hub-AZ-list__card__secondary")
              .text();
            const href_el = $(element).find("h4").find("a").attr("href");
            const obj_ = {
              title: title_el.replace(/\s\s+/g, ""),
              author: author_el,
              href: href_el,
            };
            resolve(obj_);
          });
        })
      ).then(async (data) => {
        let f = path.join(process.cwd(), "book_list.json");
        return await fsp
          .writeFile(f, JSON.stringify(data))
          .then(() => console.log("done"));
      });
    })
    .catch((err) => console.log("Fetch error " + err));
}

async function compare_book_list() {
  const spark_list = require("./book_list.json");
  let found_books = [];
  return Promise.all(
    all_books.map((x) => {
      return new Promise((resolve, reject) => {
        let match = spark_list.find(
          (y) => y.title.toLowerCase() == x.title.toLowerCase()
        );
        if (match) {
          match.id = x.id;
          resolve(found_books.push(match));
        } else {
          let partial_match_forward = spark_list.filter((y) =>
            x.title.toLowerCase().includes(y.title.toLowerCase())
          );
          let partial_match_backward = spark_list.filter((y) =>
            y.title.toLowerCase().includes(x.title.toLowerCase())
          );
          let author_match = spark_list.find(
            (y) => y.author.toLowerCase() == x.author.toLowerCase()
          );

          if (
            author_match &&
            (partial_match_backward.length > 0 ||
              partial_match_forward.length > 0)
          ) {
            author_match.id = x.id;
            resolve(found_books.push(author_match));
          } else {
            resolve();
          }
        }
      });
    })
  )
    .catch((err) => console.log(err))
    .then(async () => {
      let f = path.join(process.cwd(), "books_to_scrape.json");
      await fsp
        .writeFile(f, JSON.stringify(found_books))
        .then(() =>
          console.log(
            "done! wrote ",
            found_books.length,
            " out of ",
            all_books.length
          )
        );
    })
    .catch((err) => console.log(err));
}

async function get_quote_data() {
  const books_to_scrape = require("./books_to_scrape.json");

  return Promise.all(
    books_to_scrape.map(async (x) =>
      limiter.schedule(async () => {
        return new Promise((resolve_book, reject) => {
          return get_book_pages(`${x.href}/quotes/`, x, resolve_book);
        });
      })
    )
  ).then(() => {
    console.log("done");
  });
}

let book_data = [];
let page_data = [];

async function get_book_pages(url_, book, resolve_book) {
  await get_page_data(url_, book)
    .then(async (next_url) => {
      if (next_url) {
        page_data = [];
        await sleep(1000).then(() => {
          get_book_pages(
            `https://www.sparknotes.com${next_url}`,
            book,
            resolve_book
          );
        });
      } else {
        if (book_data.length > 0) {
          let write_data = [].concat.apply([], book_data);

          let f = path.join(process.cwd(), "book_data", `${book.id}.json`);
          await fsp.writeFile(f, JSON.stringify(write_data)).then(() => {
            page_data = [];
            book_data = [];
            resolve_book();
          });
        } else {
          page_data = [];
          book_data = [];
          resolve_book();
        }
      }
    })
    .catch((err) => console.log(err));
}

async function get_page_data(url_, book) {
  console.log(book.title, "--------- fetching ", url_);

  return await axios
    .get(url_, { timeout: 3000 })
    .then((response) => {
      const $ = cheerio.load(response.data);
      const container_div = $(".mainTextContent .main-container");
      const children = container_div.children();

      return Promise.all(
        children.map((i, element) => {
          return new Promise((resolve_, reject) => {
            let class_name = $(element).attr("class");
            if (class_name == "mainTextContent__quote") {
              let quote_text_pre = $(element)
                .text()
                .trim()
                .replace(/\n/g, " ")
                .replace(/\t/g, " ")
                .replace(/\s\s+/g, " ")
                .replace(/  +/g, " ")
                .replaceAll(" ...", "...")
                .replaceAll(". . . .", "...")
                .replaceAll(".... ", "....");
              let quote_text = !isNaN(quote_text_pre.charAt(0))
                ? quote_text_pre.slice(3, quote_text_pre.length - 1)
                : quote_text_pre;
              let desc_text = $(element)
                .nextUntil(".mainTextContent__quote")
                .filter("p")
                .text()
                .trim()
                .replace(/\n/g, " ")
                .replace(/\t/g, " ")
                .replace(/\s\s+/g, " ")
                .replace(/  +/g, " ")
                .replaceAll(" ...", "...")
                .replaceAll(". . . .", "...")
                .replaceAll(".... ", "....");

              let obj_ = { quote: quote_text, desc: desc_text, page: url_ };
              if (
                quote_text &&
                quote_text.length > 0 &&
                desc_text &&
                desc_text.length > 0
              ) {
                resolve_(page_data.push(obj_));
              } else {
                resolve_();
              }
            } else {
              resolve_();
            }
          }).catch((err) => console.log(err));
        })
      )
        .catch((err) => console.log(err))
        .then(() => {
          let next_url = $(".page-turn-nav__link--next").attr("href");

          if (page_data && page_data.length > 0) {
            book_data.push(page_data);
          }

          return next_url;
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => {
      //  console.log(err);
      console.log("fetch error!");
      let alt_url = `${book.href.replace(
        "http://www.sparknotes.com",
        ""
      )}/quotes-by-character/`;
      if (alt_url == url_.replace("https://www.sparknotes.com", "")) {
        return undefined;
      } else {
        return alt_url;
      }
    });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function get_scraped_list() {
  let book_data_files = [];
  const data_folder_path = path.join(process.cwd(), "book_data");
  const books_to_scrape = require("./books_to_scrape.json");

  return fsp
    .readdir(data_folder_path)
    .then((files) => {
      return files.forEach(function (file) {
        let id = file.replace(".json", "");
        let match = books_to_scrape.filter((x) => x.id == id)[0];
        book_data_files.push(match);
      });
    })
    .then(async () => {
      let f = path.join(process.cwd(), `scraped_book_list.json`);
      await fsp.writeFile(f, JSON.stringify(book_data_files)).then(() => {
        console.log(
          "done - file count: ",
          book_data_files.length,
          " out of ",
          books_to_scrape.length
        );
      });
    })
    .catch((err) => console.log(err));
}

async function fix_quotes() {
  const list = require("./scraped_book_list.json");

  return Promise.all(
    list.map(async (file) => {
      return new Promise(async (resolve, reject) => {
        let data = require(`./book_data/${file.id}.json`);

        return Promise.all(
          data.map(async (d) => {
            return new Promise((r_, reject) => {
              let quote_text = d.quote
                .replaceAll(" ...", "...")
                .replaceAll(". . . .", "...")
                .replaceAll(".... ", "....")
                .slice(0, 100); //.replaceAll('“', '').replaceAll('”', '')
              let desc_text = d.desc
                .replaceAll(" ...", "...")
                .replaceAll(". . . .", "...")
                .replaceAll(".... ", "...."); //.replaceAll('“', '').replaceAll('”', '')
              let obj = { page: d.page, quote: quote_text, desc: desc_text };
              r_(obj);
            });
          })
        )
          .then(async (new_data) => {
            let f =  path.join(process.cwd(), 'book_data', `${file.id}.json`) //path may need to be changed here
            await fsp.writeFile(f, JSON.stringify(new_data)).then(() => {
              //console.log('done - ', file )
              resolve();
            });
          })
          .catch((err) => console.log(err));
      });
    })
  ).then(() => console.log("done"));
}

// RUN AFTER RUNNING BOOK READER TO MATCH QUOTES IN TEXT
async function get_complete_list() {
  let book_data_files = [];
  const data_folder_path = `C:/Users/jonst/projects/book_reader/src/app/data/complete_book_data`; //path.join(process.cwd(), 'complete_book_data')
  const books_to_scrape = require("./books_to_scrape.json");

  return fsp
    .readdir(data_folder_path)
    .then((files) => {
      return files.forEach(function (file) {
        let check = require(`C:/Users/jonst/projects/book_reader/src/app/data/complete_book_data/${file}`);

        if (check.length > 0) {
          let id = file.replace(".json", "");
          let match = books_to_scrape.filter((x) => x.id == id)[0];

          let match_ = { ...match, count: check.length };
          book_data_files.push(match_);
        }
      });
    })
    .then(async () => {
      let f = `C:/Users/jonst/projects/book_reader/src/app/data/complete_scraped_book_list.json`; //path.join(process.cwd(), `complete_scraped_book_list.json`)
      await fsp.writeFile(f, JSON.stringify(book_data_files)).then(() => {
        console.log(
          "done - file count: ",
          book_data_files.length,
          " out of ",
          books_to_scrape.length
        );
      });
    })
    .catch((err) => console.log(err));
}

// not related to scraper
async function remove_duplicates() {
  let arr = require("./all_book_data.json");

  let new_list = [];

  arr.map((item, index) => {
    let check = new_list.filter((x) => x.title == item.title);

    if (check.length > 0) {
      console.log("duplicate! ", item.title);
    } else {
      new_list.push(item);
    }
  });

  const f = path.join(process.cwd(), "final_book_data.json");
  await fsp.writeFile(f, JSON.stringify(new_list)).then(() => {
    console.log("old: ", arr.length, " => new: ", new_list.length);
  });
}

async function add_count_to_book_list() {
  let arr = require("C:/Users/jonst/projects/book_reader/src/app/data/alL_book_data.json");
  let complete_scraped_book_list = require("C:/Users/jonst/projects/book_reader/src/app/data/complete_scraped_book_list.json");

  let new_arr = arr.map((x) => {
    let check = complete_scraped_book_list.filter((y) => y.id == x.id);

    console.log(check);

    if (check && check.length > 0) {
      let new_ = { ...x, count: check[0].count };
      return new_;
    } else {
      let new_ = { ...x, count: 0 };
      return new_;
    }
  });

  const f = path.join(
    "C:/Users/jonst/projects/book_reader/src/app/data/updated_all_book_data.json"
  );
  await fsp.writeFile(f, JSON.stringify(new_arr)).then(() => {
    console.log("done ");
  });
}

app.listen(8080, add_count_to_book_list());
