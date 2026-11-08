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

async function initialise_quote_widths() {
    let quote_container_width = (document.body.offsetWidth - banner.offsetWidth) * 0.5;
    let quotes_styles = getComputedStyle($(".quotes > div")[0]);
    const quotes_interval = await get_website_variable("Quotes Interval") * 1000;
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
        quote_carousel(quotes_interval, true);
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

function stagger_post_its() {
    const post_its = $(".post-it");
    post_its.forEach((post_it, index) => {
        setTimeout(() => {
            post_it.style.transition = "opacity 0s ease, max-height 0s ease, transform 250ms ease";
            post_it.classList.remove("pre-render");
            setTimeout(() => {
                activate(post_it);
                if(window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
                    post_it.style.transition = "opacity 1s 250ms ease, max-height 1.25s ease-in, transform 250ms ease";
                }
            }, 250);
        }, index * 125)
    })
}

function post_its_logic() {
    const hero_btn = $(".call-to-action > a")[0];
    const post_its_container = $(".post-its")[0];

    let post_its_triggered = false;
    let user_scrolled = false;

    function trigger_post_its() {
        if (post_its_triggered) return;
        post_its_container.style.height = post_its_container.offsetHeight + 100 + "px";

        post_its_triggered = true;
        stagger_post_its();

        observer.disconnect();
        window.removeEventListener("scroll", handle_scroll);
    }

    function handle_scroll() {
        trigger_post_its();
    }

    hero_btn.onclick = () => trigger_post_its();

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && user_scrolled) {
            trigger_post_its();
        }
    }, {
        threshold: 0.1
    });

    observer.observe(post_its_container);
    window.addEventListener("scroll", handle_scroll);
}

async function main() { 
    console.log("Index Main Started!");
    if(window.innerWidth < 700) shift_dom_el($(".call-to-action")[0], 2);

    const loader = append_loader();
    $(".landing-section")[0].appendChild(loader);

    const dyn_data_res = await fetch_data("dyn_content");
    const dyn_data = parse_document(dyn_data_res)
    await populate_dyn_containers(dyn_data);
    
    const carousel_interval = await get_website_variable("Carousel Interval") * 1000;
    const carousel_speed = await get_website_variable("Carousel Speed");
    const carousel_indicators = $(".carousel-indicator");
    
    await generate_fullscreen_carousel();
    await generate_carousel_indicators(carousel_indicators);
    initialise_quote_widths();

    const post_its_res = await fetch_data("post_its");
    const post_its_obj = parse_table(post_its_res)

    generate_post_its($(".post-its")[0], post_its_obj);
    
    document.body.style.setProperty("--fullscreen-img-height", background_wrapper.querySelector(".carousel-item").offsetHeight + "px");
    document.body.style.setProperty("--carousel-interval", carousel_speed + "s");
    create_portrait_mask($(".portrait")[0], banner);
    $(".carousel-item.extra").forEach(extra => extra.style.display = "initial");
    

    fade_in(background_wrapper);
    const portrait_wrapper = $(".portrait-carousel")[0];
    if(portrait_wrapper.offsetWidth >= window.innerWidth || window.innerWidth < 1000) {
        portrait_wrapper.style.overflowX = "clip";
    }

    fade_in(portrait_wrapper);

    deactivate(loader);
    
    let carousel_index = 0;
    let carousel_length = background_wrapper.children.length;
    let is_moving = false;
    let pending_direction = null;

    const slide_wrappers = [background_wrapper, portrait_wrapper].filter(Boolean);

    const slide_state_classes = [
        "active", "deactivating",
        "carousel-prep-left", "carousel-prep-right",
        "carousel-deactivating-left", "carousel-deactivating-right",
        "carousel-offscreen-left", "carousel-offscreen-right"
    ];

    function clear_slide_state(element) {
        element.classList.remove(...slide_state_classes);
    }

    function css_time_to_ms(value) {
        const time = parseFloat(value) || 0;
        return value.trim().endsWith("ms") ? time : time * 1000;
    }

    function get_transition_time(element) {
        const styles = getComputedStyle(element);
        const durations = styles.transitionDuration.split(",").map(css_time_to_ms);
        const delays = styles.transitionDelay.split(",").map(css_time_to_ms);

        return Math.max(
            ...durations.map((duration, i) => duration + delays[i % delays.length])
        );
    }

    function focus_carousel_el(reverse = false) {
        if (is_moving || carousel_length < 2) return;

        const prev_index = carousel_index;
        const direction = reverse ? -1 : 1;
        const next_index = (prev_index + direction + carousel_length) % carousel_length;

        const entering_side = reverse ? "left" : "right";
        const exiting_side = reverse ? "right" : "left";

        const prep_class = `carousel-prep-${entering_side}`;
        const exit_class = `carousel-deactivating-${exiting_side}`;
        const offscreen_class = `carousel-offscreen-${exiting_side}`;

        is_moving = true;
        carousel_index = next_index;

        // Calculate the actual CSS transition time, including its delay.
        const transition_time = Math.max(
            ...slide_wrappers.map(wrapper =>
                get_transition_time(wrapper.children[prev_index])
            )
        );

        // Prepare the incoming and outgoing elements.
        slide_wrappers.forEach(wrapper => {
            const incoming = wrapper.children[next_index];
            const outgoing = wrapper.children[prev_index];

            clear_slide_state(incoming);

            incoming.classList.add(prep_class);

            // Ensure the outgoing element starts centred.
            outgoing.classList.remove(
                "deactivating",
                "carousel-prep-left", "carousel-prep-right",
                "carousel-deactivating-left", "carousel-deactivating-right",
                "carousel-offscreen-left", "carousel-offscreen-right"
            );

            outgoing.classList.add("active");

            // Force the browser to calculate the incoming element's
            // starting position before beginning the animation.
            void incoming.offsetWidth;
        });

        requestAnimationFrame(() => {

            // Start the actual transition.
            slide_wrappers.forEach(wrapper => {
                const incoming = wrapper.children[next_index];
                const outgoing = wrapper.children[prev_index];

                incoming.classList.remove(prep_class);
                incoming.classList.add("active");

                outgoing.classList.remove("active");
                outgoing.classList.add(exit_class);
            });

            // Update indicators independently of the slide direction.
            carousel_indicators.forEach(container => {
                const incoming = container.children[next_index];
                const outgoing = container.children[prev_index];

                if (incoming) activate(incoming);
                if (outgoing) deactivate(outgoing, 0, transition_time);
            });

            // Finish only after the CSS transitions have completed.
            setTimeout(() => {

                slide_wrappers.forEach(wrapper => {
                    const outgoing = wrapper.children[prev_index];

                    outgoing.classList.remove(exit_class);
                    outgoing.classList.add(offscreen_class);
                });

                is_moving = false;

                // Process a manual click received during the animation.
                if (pending_direction !== null) {
                    const next_reverse = pending_direction < 0;
                    pending_direction = null;

                    focus_carousel_el(next_reverse);
                }

            }, transition_time + 50);
        });
    }


    // Automatic movement.
    const carousel_interval_id = setInterval(() => {
        if (!is_moving) focus_carousel_el();
    }, carousel_interval);


    // Manual controls.
    function control_carousel(reverse = false) {
        clearInterval(carousel_interval_id);

        if (is_moving) {
            // Remember the most recently requested direction.
            pending_direction = reverse ? -1 : 1;
            return;
        }

        focus_carousel_el(reverse);
    }

    const carousel_controls = $(".carousel-controls")[0];

    activate(carousel_controls);

    carousel_controls.querySelector(".left").onclick = () => {
        control_carousel(true);
    }; 

    carousel_controls.querySelector(".right").onclick = () => {
        control_carousel(false);
    };

    carousel_controls.ontouchmove = (e) => {
        if(e.target.closest("button")) return;
        portrait_wrapper.ontouchmove?.call(portrait_wrapper, e)
    };
    carousel_controls.ontouchend = (e) => {
        if(e.target.closest("button")) return;
        portrait_wrapper.ontouchend?.call(portrait_wrapper, e)
    };

    let clientX = 0;
    let direction = 0;

    portrait_wrapper.ontouchmove = (e) => {
        let x = e.touches[0].clientX;
        direction = x > clientX ? 1 : -1;
        clientX = x;
    }

    portrait_wrapper.ontouchend = (e) => {
        control_carousel(reverse = direction === 1)
        // direction polarity is flipped for natural "grabbing" motion
        clientX = 0;
    }

    const call_to_action = $(".call-to-action")[0];
    call_to_action.style.setProperty("--height", call_to_action.offsetHeight + "px");
    call_to_action.style.setProperty("--indicator-height", call_to_action.querySelector(".carousel-indicator").offsetHeight + "px");
    if(call_to_action.offsetHeight + call_to_action.offsetTop + 16 * 2.5 > window.innerHeight && window.innerWidth > 700) { // 2.5rem added to margin
        call_to_action.style.setProperty("--extra-margin", ((call_to_action.offsetHeight + call_to_action.offsetTop) - window.innerHeight) + "px")
        call_to_action.classList.add("force-bottom")
    }

    generate_background();
    Array.from(quotes.children).forEach(el => fade_in(el))

    post_its_logic();
}

promise__initial_page_rendering.then(() => main())
    