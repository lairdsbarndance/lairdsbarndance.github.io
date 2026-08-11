fetch_data("quotes_table")
.then(json => generate_quotes(json))

const banner = $(".banner")[0];
const quotes = $(".quotes")[0];
const mobile_quotes = $(".mobile-quotes")[0];

function quote_carousel(interval, alternate = false) {
    const mobile_quotes = $(".mobile-quotes > div > .quote");
    $(".quotes:not(.mobile-quotes) > div").forEach((side, i) => {
        let increment = 1;
        $(".quotes:not(.mobile-quotes) > div > .quote:first-child").forEach(initial_quote => activate(initial_quote))
        console.log(interval + (alternate ? i * (interval / 2) : 0))
        setTimeout(() => {
            setInterval(() => {
                Array.from(side.childNodes).forEach((quote, j) => {
                    if(increment % Array.from(side.childNodes).length === j) { activate(quote, delay = 500) }
                    else { deactivate(quote) }
                })
                increment++
            }, interval);
        }, (alternate ? i * (interval / 2) : 0));
    })

    mobile_quotes.forEach((quote, i) => {
        let increment = 0;
        activate($(".mobile-quotes > div > .quote:first-child")[0]);
        setInterval(() => {
            if(increment % mobile_quotes.length === i) {activate(quote)}
            else {deactivate(quote)}
            increment++;
        }, interval / 2);
    })
}

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        let quote_container_width = (document.body.offsetWidth - banner.offsetWidth) * 0.5;
        let quotes_styles = getComputedStyle($(".quotes > div")[0])
        quotes.style.setProperty("--quotes-width", quote_container_width + "px");

        mobile_quotes.style.setProperty(
            "--max-width",
            `${Math.max(
                ...Array.from($(".mobile-quotes > div > .quote"))
                    .map(child => child.offsetWidth)
            )}px`
        );
        
        mobile_quotes.style.setProperty(
            "--max-height",
            `${Math.max(
                ...Array.from($(".mobile-quotes > div > .quote"))
                    .map(child => child.offsetHeight)
            )}px`
        );

        if(parseFloat(quotes_styles["min-width"].split("px")[0]) > quote_container_width) {
            quotes.classList.add("beside-banner");
            quotes.style.setProperty("--banner-height", banner.offsetHeight + "px");
            quote_carousel(10000, true);
        }
    }, 1)
})

const background_wrapper = $(".background-wrapper")[0];
const band_type = background_wrapper.getAttribute("data-band-type");
Array.from(background_wrapper.children).forEach(el => el.src = `/assets/homepage/${band_type}_fullscreen/${el.classList[0]}.png`);
