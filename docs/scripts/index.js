fetch_data("quotes_table")
.then(json => generate_quotes(json))

const banner = $(".banner")[0];
const quotes = $(".quotes")[0];

function quote_carousel(interval, alternate = false) {
    $(".quotes > div").forEach((side, i) => {
        let increment = 1;
        $(".quotes > div > .quote:first-child").forEach(initial_quote => activate(initial_quote))
        setTimeout(() => {
            setInterval(() => {
                Array.from(side.childNodes).forEach((quote, j) => {
                    if(increment % Array.from(side.childNodes).length === j) { activate(quote, delay = 500) }
                    else { deactivate(quote) }
                })
                increment++
            }, interval);
        }, i * interval * (alternate ? 1 : 0));
    })
}

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        let quote_container_width = (document.body.offsetWidth - banner.offsetWidth) * 0.5;
        let quotes_styles = getComputedStyle($(".quotes > div")[0])
        quotes.style.setProperty("--quotes-width", quote_container_width + "px");
        if(parseFloat(quotes_styles["min-width"].split("px")[0]) > quote_container_width) {
            quotes.classList.add("beside-banner");
            quotes.style.setProperty("--banner-height", banner.offsetHeight + "px");
            quote_carousel(5000);
        }
    }, 1)
})

const background_wrapper = $(".background-wrapper")[0];
const band_type = background_wrapper.getAttribute("data-band-type");
Array.from(background_wrapper.children).forEach(el => el.src = `/assets/homepage/${band_type}_fullscreen/${el.classList[0]}.png`);
