function handle_click_event(event, is_expanded, events_container, original_scroll_top) {
    const package_type = event.querySelector(".package-type");
    package_type.textContent = package_type.textContent.replace(is_expanded ? "," : ":", is_expanded ? ":" : ",");
    if(is_expanded) {
        event.style.setProperty("--transition-overflow", "hidden");
        event.scrollTop = 0;
        setTimeout(() => {
            event.style.setProperty("--transition-overflow", "auto")
        }, 250);
        const min_height = $(".banner")[0].getBoundingClientRect().bottom;
        correct_scroll_top(event, events_container, min_height);
    }
}

function correct_scroll_top(target_el, scroll_el, min_height, margin = 16) {
    const rect = target_el.getBoundingClientRect();

    if(rect.top < min_height + margin) {
        scroll_el.scrollTop -= 5;
    } else if(rect.bottom > document.documentElement.clientHeight - margin) {
        scroll_el.scrollTop += 5;
    } else {
        return;
    }

    requestAnimationFrame(() => correct_scroll_top(target_el, scroll_el, min_height));
}

async function focus_event(events, index, direction = 1, events_container, preserve_event = null) {
    const focused_event = events[index];
    const scroll_el = events[0].parentElement;

    events.forEach(el => {
        el.classList.remove("focused");

        if (el !== preserve_event) {
            el.classList.remove("expanded");
            handle_click_event(el, false, events_container, 0);
        }
    });

    focused_event.classList.add("focused");

    if (!direction) return;

    const target_top = scroll_el.scrollTop + focused_event.getBoundingClientRect().height * direction;

    if (Math.abs(scroll_el.scrollTop - target_top) < 1) return;

    await new Promise(resolve => {
        let stable_frames = 0;
        let last_top = scroll_el.scrollTop;
        let frames = 0;

        function check_scroll() {
            const current_top = scroll_el.scrollTop;
            frames++;

            if (Math.abs(current_top - target_top) < 1) {
                resolve();
                return;
            }

            if (Math.abs(current_top - last_top) < 0.1) {
                stable_frames++;
            } else {
                stable_frames = 0;
            }

            if (stable_frames >= 8 || frames >= 120) {
                resolve();
                return;
            }

            last_top = current_top;
            requestAnimationFrame(check_scroll);
        }

        scroll_el.scrollTo({
            top: target_top,
            behavior: "smooth"
        });

        setTimeout(() => {
            const min_height = $(".banner")[0].getBoundingClientRect().bottom;
            correct_scroll_top(focused_event, scroll_el, min_height);
        }, 1000);

        requestAnimationFrame(check_scroll);
    });

}

function update_relative_index(events, focused_event_index) {
    events.forEach((event, index) => {
        event.style.setProperty("--relative-event-index", focused_event_index - index);
    })
}

async function main() {
    const events_obj = await fetch_events();
    const events_container = $(".events")[0];
    const banner = $(".banner")[0];
    const main_el = $("main")[0];
    const timeline = $(".timeline")[0];

    const package_colours = [
        {package: "Fiddler and Caller", colour: "#C0A4EF"}, 
        {package: "2-piece and caller", colour: "#DE5959"}, 
        {package: "3-piece and caller", colour: "#FFD78D"}, 
        {package: "4-piece and caller", colour: "#FFA88D"}, 
        {package: "Bluegrass and caller", colour: "#82FFF0"}
    ];

    // generate events here

    const events = $(".event");
    const original_padding_top = getComputedStyle(main_el).getPropertyValue("--padding-top");
    const scroll_height = (document.documentElement.clientHeight - banner.getBoundingClientRect().bottom - 100);
    banner.classList.add("minimise"); banner.style.transitionDuration = "0ms";
    events_container.style.setProperty("--max-height", scroll_height + "px");
    events_container.style.setProperty("--extra-overflow", events[events.length - 1].offsetHeight + "px");
    timeline.style.left = events_container.getBoundingClientRect().left + "px";
    banner.classList.remove("minimise");
    
    banner.style.transitionDuration = "";

    events_container.addEventListener("scroll", (e) => {
        if(events_container.scrollTop !== 0) {
            main_el.style.setProperty("--padding-top", banner.getBoundingClientRect().bottom + "px");
            banner.classList.add("minimise");
        } else {
            main_el.style.setProperty("--padding-top", original_padding_top);
            banner.classList.remove("minimise")
        }
        update_relative_index(events, focused_event_index);
    })

    events.forEach((event, index) => {
        event.addEventListener("click", () => {
            const is_expanded = !event.classList.contains("expanded");

            if (is_expanded) {
                focused_event_index = index;
                update_relative_index(events, focused_event_index);
                focus_event(events, focused_event_index, 0, events_container, event);
                event.classList.add("expanded");
            } else {
                event.classList.remove("expanded");
            }

            const original_scroll_top = events_container.scrollTop;
            handle_click_event(event, is_expanded, events_container, original_scroll_top);
        });
    });

    let focused_event_index = 0;
    let await_scroll = false;
    let timeouts = [];
    update_relative_index(events, focused_event_index);

    focus_event(events, focused_event_index, 0, events_container);

    events_container.addEventListener("wheel", async (e) => {
        const closest_event = e.target.closest(".event");

        if (closest_event?.classList.contains("expanded") && closest_event?.scrollHeight > closest_event?.offsetHeight) {
            return;
        }

        events.forEach(event => {
            if (!event.classList.contains("expanded")) return;

            event.classList.remove("expanded");
            handle_click_event(event, false, events_container, events_container.scrollTop);
        });

        timeouts = timeouts.filter(timeout => {
            if(!timeout.el.classList.contains("focused")) {
                clearTimeout(timeout.timeout_id);
                return false;
            }
            return true;
        });

        e.preventDefault();
        if (await_scroll) return;

        const direction = Math.sign(e.deltaY);
        if (!direction) return;

        const next_index = Math.min(
            Math.max(0, focused_event_index + direction),
            events.length - 1
        );

        if (next_index === focused_event_index) return;

        await_scroll = true;
        focused_event_index = next_index;

        try {
            var original_scroll_top = events_container.scrollTop;
            await focus_event(events, focused_event_index, direction, events_container);
        } finally {
            const focused_el = Array.from(events).find(el => el.classList.contains("focused"));
            const timeout_id = setTimeout(() => {
                if(focused_el.classList.contains("focused")) {
                    focused_el.classList.add("expanded");
                    handle_click_event(focused_el, true, events_container, original_scroll_top);
                }
            }, 1000);
            timeouts.push({el: focused_el, timeout_id: timeout_id});
            await_scroll = false;
        }
    }, { passive: false });
}

promise__initial_page_rendering.then(() => main())