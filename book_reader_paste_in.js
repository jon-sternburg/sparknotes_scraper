/*
// used to map cfis to scraped sparknote quote data

  useEffect(() => {
    async function write_quote_data(quote_data) {

      return await fetch("/api/write_quote_data", {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quote_data: quote_data, book_id: props.selected_book.id })
      })
        .then((res) => res.json())
        .then((data) => {

          let next_book_id = list.findIndex(x => x.id == props.selected_book.id)
          if (next_book_id >= 0) { 

            let next_book = list[next_book_id + 1]

      
          window.location.href = `http://localhost:3000/book/${next_book.id}`
          }
    
        })
        .catch(err => {
          console.log(err)
          return null
        })

    }
    async function search_text(q_) {



      if (book.current && book.current != null ) {
        let quote = q_.quote
        let spine_ = book.current.spine
        let spine_items_ = isSpine(spine_) ? spine_.spineItems : []
      return await Promise.all(spine_items_.map(async x => {
          return await new Promise(async (resolve, reject) => {
            resolve(await x.load(book.current.load.bind(book.current)))
          })
            .then(async () => {
           return   await x.find(quote)
            })
            .then((s) => {
              let obj_ = { s: s, x: x }
              if (s.length > 0) { return obj_ }
            })
        })).catch(err => console.log(err))
        .then((results_) => {

          let results = results_.filter(z => z !== undefined)

          let res_ = results.map(x => {
            let matching = toc.current.filter(y => y.href.slice(0, y.href.indexOf('#')) == x.x.href)
            let label = matching && matching[0] && matching[0].label ? matching[0].label : ''
            return {section: label.trim(), cfi: x.s[0].cfi, quote: quote, desc: q_.desc, page: q_.page  }
          })
                  //removes duplicate 
                  if (res_.length > 1) { res_.pop()}
                 return res_
          
        })
      }
    }



    async function start_fetch() {


      console.log('fetching id: ', props.selected_book.id)
      await fetch(`/book_data/${props.selected_book.id}.json`, { cache: 'no-store' })
      .then((res) => res.json())
      .then(async (quote_data) => {
    
    console.log('quote_data initial fetch ', quote_data)
     await Promise.all(quote_data.map(async x => {
    return await search_text(x)
    })).catch(err => console.log(err))
    .then(async (d) => {
    let final = [].concat.apply([], d).filter( x => x !== undefined)
      console.log('final: ', final)
      console.log('found ', final.length ,' out of ', quote_data.length)
    
    await write_quote_data(final)
    
    }).catch(err => console.log(err))
    })
    }

if (props.selected_book.id) { 
  setTimeout(() => {
    start_fetch()
  }, 3000);


}
      }, [props.selected_book.id])

*/