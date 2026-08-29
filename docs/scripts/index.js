fetch_data("quotes_table")
.then(json => generate_quotes(json))

const banner = $(".banner")[0];
const quotes = $(".quotes")[0];
const mobile_quotes = $(".mobile-quotes")[0];
const carousel_extras = ["1.jpeg"]
const band_types = ["english", "irish"]

function quote_carousel(interval, alternate = false) {
    const mobile_quotes = $(".mobile-quotes > div > .quote");
    $(".quotes:not(.mobile-quotes) > div").forEach((side, i) => {
        let increment = 1;
        $(".quotes:not(.mobile-quotes) > div > .quote:first-child").forEach(initial_quote => activate(initial_quote))
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

function initialise_quote_widths() {
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
        quote_carousel(get_website_variable("Quotes Interval") * 1000, true);
    }
}

const background_wrapper = $(".background-wrapper")[0];

async function generate_fullscreen_carousel() {
    band_types.forEach((band_type, i) => {
        background_wrapper.innerHTML += `
        <div class="carousel-item ${band_type} ${(i === 0 ? "active" : "")}">
        <img class="cleanplate" src="/assets/homepage/${band_type}_fullscreen/cleanplate.png">
        <img class="vignette" src="/assets/homepage/${band_type}_fullscreen/vignette.png">
        <img class="portrait" src="/assets/homepage/${band_type}_fullscreen/portrait.png">
        </div>
        `
    })
    
    carousel_extras.forEach(extra => {
        background_wrapper.innerHTML += `
        <div class="carousel-item extra">
        <img src="/assets/homepage/carousel_photos/${extra}">
        </div>
        `
    })
    
    await Promise.all(
        [...background_wrapper.querySelectorAll("img")].map(img => {
            if(img.complete) return;
            return new Promise(resolve => img.onload = resolve);
        })
    );
}


function create_portrait_mask(portrait, banner) {
    const rect = portrait.getBoundingClientRect();
    
    const portrait_carousel = $el(".portrait-carousel,background-wrapper,pre-render");
    
    document.body.appendChild(portrait_carousel);
    
    portrait_carousel.style.position = "absolute";
    portrait_carousel.style.left = `${rect.left + window.scrollX}px`;
    portrait_carousel.style.top = `${rect.top + window.scrollY}px`;
    portrait_carousel.style.width = `${rect.width}px`;
    portrait_carousel.style.height = `${rect.height}px`;
    
    band_types.forEach((band_type, i) => {
        portrait_carousel.innerHTML += `
        <div class="carousel-item ${band_type} ${(i === 0 ? "active" : "")}">
        <img class="portrait" src="/assets/homepage/${band_type}_fullscreen/portrait.png">
        </div>
        `;
    });
    
    carousel_extras.forEach(extra => {
        portrait_carousel.innerHTML += `
        <div class="carousel-item extra">
        <img src="/assets/homepage/irish_fullscreen/portrait.png" style="opacity: 0;">
        </div>
        `
    })
}

async function generate_carousel_indicators(carousel_indicators) {
    const carousel_length = background_wrapper.children.length;
    carousel_indicators.forEach(container => {
        for(let i = 0; i < carousel_length; i++) {
            const dot = $el(".dot");
            if(i === 0) activate(dot)
                container.appendChild(dot);
        }
    })
}

async function main() { 
    console.log("Index Main Started!");
    if(window.innerWidth < 700) shift_dom_el($(".call-to-action")[0], 2)
    
    const carousel_interval = get_website_variable("Carousel Interval") * 1000;
    const carousel_indicators = $(".carousel-indicator");
    
    await generate_fullscreen_carousel();
    await generate_carousel_indicators(carousel_indicators);
    initialise_quote_widths();
    
    document.body.style.setProperty("--fullscreen-img-height", background_wrapper.querySelector(".carousel-item").offsetHeight + "px");
    document.body.style.setProperty("--carousel-interval", get_website_variable("Carousel Speed") + "s");
    create_portrait_mask($(".portrait")[0], banner);
    $(".carousel-item.extra").forEach(extra => extra.style.display = "initial");
    
    fade_in(background_wrapper);
    const portrait_wrapper = $(".portrait-carousel")[0];
    fade_in(portrait_wrapper);
    
    let carousel_increment = 0;
    setInterval(() => {
        const previous_increment = carousel_increment;
        carousel_increment++;
        if(carousel_increment > background_wrapper.children.length - 1) carousel_increment = 0;

        activate(background_wrapper.children[carousel_increment]);
        deactivate(background_wrapper.children[previous_increment], 0, carousel_interval)

        carousel_indicators.forEach(container => {
            activate(container.children[carousel_increment]);
            deactivate(container.children[previous_increment], 0, carousel_interval)
        })

        activate(portrait_wrapper.children[carousel_increment]);
        deactivate(portrait_wrapper.children[previous_increment], 0, carousel_interval);
    }, carousel_interval);

    const call_to_action = $(".call-to-action")[0];
    call_to_action.style.setProperty("--height", call_to_action.offsetHeight + "px");
    call_to_action.style.setProperty("--indicator-height", call_to_action.querySelector(".carousel-indicator").offsetHeight + "px");
    if(call_to_action.offsetHeight + call_to_action.offsetTop > window.innerHeight) {
        call_to_action.style.setProperty("--extra-margin", ((call_to_action.offsetHeight + call_to_action.offsetTop) - window.innerHeight) + "px")
        call_to_action.classList.add("force-bottom")
    }
    generate_background();
    Array.from(quotes.children).forEach(el => fade_in(el))
}

promise__initial_page_rendering.then(() => {main()})
    