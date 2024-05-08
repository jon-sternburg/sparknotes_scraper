# Sparknotes Scraper

Webscraper built with Cheerio to support Gutenberg Annotation project ([Reader](https://github.com/jon-sternburg/reader)). Performs following functions - 

- get_book_list - gets list of books from https://www.sparknotes.com/lit/
- compare_book_list - compares sparknotes list to book reader list and writes list of matching books ready to scrape with href
- get_quote_data - cycles through books_to_scrape.json to fetch quote data from all quote pages on sparknotes
- get_scraped_list - compiles list of books with successfully scraped quote data
- get_complete_list - compiles list of books with quotes found in text
