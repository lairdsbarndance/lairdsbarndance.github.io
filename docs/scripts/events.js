const timeline_svg = $(".timeline")[0];
const events_container_gap = parseFloat((getComputedStyle($(".events")[0]).rowGap).split("px")[0]);
let event_expanded = false;

function get_outward_boundary(event, direction, tolerance = 2) {
    const max_scroll_top = Math.max(0, event.scrollHeight - event.clientHeight);

    if (direction < 0 && event.scrollTop <= tolerance) return "top";
    if (direction > 0 && event.scrollTop >= max_scroll_top - tolerance) return "bottom";

    return null;
}

function process_boundary_scroll(state, event, boundary, direction, event_index, event_count) {
    const is_outer_boundary =
        (event_index === 0 && boundary === "top" && direction === -1) ||
        (event_index === event_count - 1 && boundary === "bottom" && direction === 1);

    // At the outermost ends, scrolling outwards must never collapse the card.
    if (is_outer_boundary) return { state: null, action: "ignore" };

    // A second input only counts when it targets the same edge in the same direction.
    if (
        state &&
        state.el === event &&
        state.boundary === boundary &&
        state.direction === direction
    ) {
        return { state: null, action: "collapse" };
    }

    return {
        state: { el: event, boundary, direction },
        action: "arm"
    };
}

function clear_event_timeouts(event, timeouts) {
    for (let i = timeouts.length - 1; i >= 0; i--) {
        if (timeouts[i].el === event) {
            clearTimeout(timeouts[i].timeout_id);
            timeouts.splice(i, 1);
        }
    }
}

function regenerate_iframes(event) {
    const iframes = event.parentElement.querySelectorAll("iframe");
    if(!iframes) return;
    iframes.forEach(iframe => {
        const src = iframe.getAttribute("src");

        const replacement = iframe.cloneNode(false);
        replacement.removeAttribute("src");

        iframe.replaceWith(replacement);
        if (src) replacement.src = src;
    });
}

function regenerate_iframes_after_minimising(event, delay = 500) {
    if (!event) return;

    setTimeout(() => {
        if (!event.classList.contains("expanded")) {
            regenerate_iframes(event);
        }
    }, delay);
}

function generate_loading_container() {
    const container = $el("div.event-container,loading-container");
    const event_container = $el("article.event,custom-scrollbar");
    const date = $el("div.date");
    const span = $el("span");

    date.appendChild(span);

    const loading = $el("img.loading,active");
    loading.src = "/assets/loading.svg";

    event_container.appendChildren(date, loading);
    container.appendChild(event_container);

    return {container, event_container, date, span, loading};
}

function collapse_expanded_event(event, events_container, events, timeouts) {
    if (!event.classList.contains("expanded")) return;
    event.classList.remove("expanded");
    handle_click_event(event, false, events_container, events);
    events_container.style.setProperty("--scroll-snap-type", "y mandatory");
    clear_event_timeouts(event, timeouts);
    setTimeout(() => {
        update_timeline(events)
    }, 500);
    regenerate_iframes_after_minimising(event)
}

function handle_click_event(event, is_expanded, events_container, events, prevent_scroll = false) {
    const package_type = event.querySelector(".package-type");
    package_type.textContent = package_type.textContent.replace(is_expanded ? "," : ":", is_expanded ? ":" : ",");
    if(is_expanded) {
        event_expanded = true;
        event.style.setProperty("--transition-overflow", "hidden");
        event.scrollTop = 0;
        initialise_read_mores(event.parentElement.querySelectorAll(".might-read-more"));
        const min_height = $(".banner")[0].getBoundingClientRect().bottom;
        setTimeout(() => {
            event.style.setProperty("--transition-overflow", "auto");
            if(!prevent_scroll) correct_scroll_top(event, events_container, min_height);
            update_timeline(events);
        }, 250);
    } else {
        event_expanded = false;
    }
}

async function correct_scroll_top(target_el, scroll_el, min_height = $(".banner")[0].getBoundingClientRect().bottom, attempts = 0, margin = 16) {
    scroll_el.style.setProperty("--scroll-snap-type", "none");
    const rect = target_el.getBoundingClientRect();
    let scroll_top = target_el.offsetTop - min_height - margin;
    await scroll_el.scrollTo({top: scroll_top, behavior: "smooth"});

    // if(rect.top < min_height + margin) {
    //     scroll_el.scrollTop -= 3;
    // } else if(rect.bottom > document.documentElement.clientHeight - margin) {
    //     scroll_el.scrollTop += 3;
    // } else {
    //     scroll_el.style.setProperty("--scroll-snap-type", "y mandatory");
    //     return;
    // }

    // requestAnimationFrame(async () => correct_scroll_top(target_el, scroll_el, min_height, attempts = attempts + 1));
}

async function focus_event(events, index, direction = 1, events_container, preserve_event = null, prevent_scroll = false) {
    const focused_event = events[index];
    const scroll_el = $(".events")[0];

    events.forEach(el => {
        el.classList.remove("focused");

        if (el !== preserve_event) {
            const was_expanded = el.classList.contains("expanded");

            el.classList.remove("expanded");
            scroll_el.style.setProperty("--scroll-snap-type", "y mandatory");
            handle_click_event(el, false, events_container, events);

            if (was_expanded) {
                regenerate_iframes_after_minimising(el);
            }
        }
    });

    focused_event.classList.add("focused");

    if (!direction || prevent_scroll) return;

    const target_top = scroll_el.scrollTop + (focused_event.getBoundingClientRect().height + events_container_gap * 3) * direction;

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

        requestAnimationFrame(check_scroll);
    });

}

function update_relative_index(events, focused_event_index) {
    events.forEach((event, index) => {
        event.style.setProperty("--relative-event-index", focused_event_index - index);
    })
}

function get_transformed_corners(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);

    const width = el.offsetWidth;
    const height = el.offsetHeight;

    const [origin_x, origin_y, origin_z = 0] = style.transformOrigin.split(" ").map(parseFloat);
    const matrix = new DOMMatrix(style.transform);

    const corners = [
        [0, 0],
        [width, 0],
        [width, height],
        [0, height]
    ].map(([x, y]) => {
        const point = new DOMPoint(
            x - origin_x,
            y - origin_y,
            -origin_z
        ).matrixTransform(matrix);

        return {
            x: point.x / point.w + origin_x,
            y: point.y / point.w + origin_y
        };
    });

    const min_x = Math.min(...corners.map(p => p.x));
    const min_y = Math.min(...corners.map(p => p.y));

    return Object.fromEntries(
        corners.map((p, i) => [
            `p${i + 1}`,
            {
                x: rect.left + p.x - min_x,
                y: rect.top + p.y - min_y
            }
        ])
    );
}

function resize_timeline_svg(timeline_svg) {
    const { clientWidth, clientHeight } = document.documentElement;

    timeline_svg.setAttribute(
      "viewBox",
      `0 0 ${clientWidth} ${clientHeight}`
    );
}

function update_timeline(events, x_offset = 10, y_offset = 50, master_offset = 8) {
    const client_height = document.documentElement.clientHeight;
    const top_event = [...Array.from(events)].filter(el => el.getBoundingClientRect().top < 0).pop() || events[0];
    const container_rect = $(".events")[0].getBoundingClientRect();
    const median_coord = {x: container_rect.left + master_offset, y: container_rect.top + container_rect.height / 2};
    const bottom_event = [...Array.from(events)].filter(el => el.getBoundingClientRect().bottom > client_height)[0] || events[events.length - 1];

    let top_corners = get_transformed_corners(top_event);
    let bottom_corners = get_transformed_corners(bottom_event);

    if(top_event === events[0]) top_corners.p1.y = top_corners.p1.y - y_offset;
    if(bottom_event === events[events.length - 1]) bottom_corners.p4.y = bottom_corners.p4.y + y_offset;

    const timeline_coords = {
        top: {
            x: top_corners.p1.x + x_offset + master_offset,
            y: top_corners.p1.y - y_offset 
        },
        median: median_coord,
        bottom: {
            x: bottom_corners.p4.x + x_offset + master_offset,
            y: bottom_corners.p4.y + y_offset
        }
    };

    update_timeline_svg({...timeline_coords, handleLength: 300});
}

function update_timeline_svg({
  top,
  median,
  bottom,
  handleLength = 100,
  duration = 300,
}) {
  const svg = document.getElementById("timeline-svg");
  const curve = svg.querySelector("#timeline-curve");

  const start_points = {};

  for (const id of ["top", "median", "bottom"]) {
    const point = id === "top" ? top : id === "bottom" ? bottom : median;
    start_points[id] = point;
  }

  // Capture the current geometry.
  const current_path = curve.getAttribute("d");
  const previous_points = svg._timeline_points;

  if (!previous_points || !current_path) {
    svg._timeline_points = structuredClone(start_points);
    update_timeline_frame(svg, start_points, handleLength);
    return;
  }

  // Cancel any animation currently in progress.
  if (svg._timeline_animation) {
    cancelAnimationFrame(svg._timeline_animation);
  }

  const from_points = structuredClone(svg._timeline_current_points || previous_points);
  const start_time = performance.now();

  function animate(now) {
    const progress = Math.min((now - start_time) / duration, 1);

    // Smooth ease-in-out.
    const eased = progress * progress * (3 - 2 * progress);

    const points = {};

    for (const id of ["top", "median", "bottom"]) {
      points[id] = {
        x: from_points[id].x + (start_points[id].x - from_points[id].x) * eased,
        y: from_points[id].y + (start_points[id].y - from_points[id].y) * eased,
      };
    }

    update_timeline_frame(svg, points, handleLength);
    svg._timeline_current_points = points;

    if (progress < 1) {
      svg._timeline_animation = requestAnimationFrame(animate);
    } else {
      svg._timeline_points = structuredClone(start_points);
      svg._timeline_animation = null;
    }
  }

  svg._timeline_animation = requestAnimationFrame(animate);
}

function update_timeline_frame(svg, { top, median, bottom }, handleLength) {
  for (const [id, point] of Object.entries({ top, bottom })) {
    for (const vertex of [
      svg.querySelector(`#mask-${id}`),
    ]) {
      vertex.setAttribute("cx", point.x);
      vertex.setAttribute("cy", point.y);
    }
  }

  const dx = bottom.x - top.x;
  const dy = bottom.y - top.y;
  const length = Math.hypot(dx, dy) || 1;

  const ux = dx / length;
  const uy = dy / length;

  const max_handle_length = Math.min(
    Math.hypot(median.x - top.x, median.y - top.y),
    Math.hypot(bottom.x - median.x, bottom.y - median.y)
  );

  const handle_length = Math.min(handleLength, max_handle_length);

  const cp1 = {
    x: median.x - ux * handle_length,
    y: median.y - uy * handle_length,
  };

  const cp2 = {
    x: median.x + ux * handle_length,
    y: median.y + uy * handle_length,
  };

  svg.querySelector("#timeline-curve").setAttribute(
    "d",
    `M ${top.x} ${top.y}
     C ${top.x} ${top.y}, ${cp1.x} ${cp1.y}, ${median.x} ${median.y}
     C ${cp2.x} ${cp2.y}, ${bottom.x} ${bottom.y}, ${bottom.x} ${bottom.y}`
  );
}

function get_ordinal_suffix(day) {
    if (day >= 11 && day <= 13) return "th";

    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

function generate_event_date(timestamp) {
    const date = new Date(timestamp);

    const parts = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London"
    }).formatToParts(date);

    const day = Number(parts.find(part => part.type === "day").value);
    const month = parts.find(part => part.type === "month").value;
    const year = parts.find(part => part.type === "year").value;

    const date_container = $el("div");
    date_container.className = "date";

    const date_text = $el("span");
    const day_text = document.createTextNode(day);

    const suffix = $el("sup");
    suffix.textContent = get_ordinal_suffix(day);

    date_text.appendChild(day_text);
    date_text.appendChild(suffix);
    date_text.appendChild(document.createTextNode(` ${month} ${year}`));

    date_container.appendChild(date_text);

    return date_container;
}

async function generate_events(events_obj, package_colours, events_container, interval = 250) {
    const loading_containers = events_obj.map(() =>
        generate_loading_container()
    );

    events_container.appendChildren(
        ...loading_containers.map(item => item.container)
    );

    setTimeout(() => {
        stagger_activate_els(Array.from(events_container.children), 125);
    }, 1000);

    await new Promise(resolve => setTimeout(resolve, 2500));

    const generated_events = [];

    for (const [index, event] of events_obj.entries()) {
        const event_start = performance.now();

        const {
            container,
            event_container: article,
            date: date_container,
            span: date_text,
            loading
        } = loading_containers[index];

        const files = event.files ?? [];
        const has_media = files.length > 0;

        // Date
        const date = new Date(event.Date);

        const date_parts = new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/London"
        }).formatToParts(date);

        const day = Number(date_parts.find(
            part => part.type === "day"
        ).value);

        const month = date_parts.find(
            part => part.type === "month"
        ).value;

        const year = date_parts.find(
            part => part.type === "year"
        ).value;

        // Populate the existing date span
        date_text.appendChild(document.createTextNode(day));

        const suffix = $el("sup");
        suffix.textContent = get_ordinal_suffix(day);

        date_text.appendChild(suffix);
        date_text.appendChild(
            document.createTextNode(` ${month} ${year}`)
        );

        // Location
        const location = $el("div.location");
        const location_text = $el("span");

        location_text.textContent = event.Venue;

        location.appendChild(location_text);
        article.appendChild(location);

        // Event description
        const heading = $el("h3");
        heading.textContent = event["Description of Event"];

        article.appendChild(heading);

        // Finish converting the loading container
        loading.remove();
        container.classList.remove("loading-container");

        // Band information
        const band_container = $el("div.band-container");

        const package_image = $el("img");
        package_image.src = "/assets/events/default_package.svg";

        band_container.appendChild(package_image);

        const band_info = $el("p.might-read-more");

        // Package type
        const package_type = $el("span.package-type");

        const package_colour = package_colours.find(
            item => item.package === event["Band Type"]
        );

        if (package_colour) {
            package_type.style.color = package_colour.colour;
        }

        package_type.textContent = `${event["Band Type"]}, `;

        band_info.appendChild(package_type);

        // Measure location
        const measure_location = $el("span.measure-location");
        measure_location.textContent = event.Venue.split(",")[0].trim();

        band_info.appendChild(measure_location);

        // Band members
        const band_members = $el("span.band-members");

        band_members.textContent = event["Players (comma-separated)"]
            .map(player => player.trim())
            .join(", ");

        band_info.appendChild(band_members);

        band_container.appendChild(band_info);
        article.appendChild(band_container);

        // Review / feedback
        if (event["Reviews / Feedback"]) {
            const quote = $el("div.quote");

            const quote_image = $el("img");
            quote_image.src = "/assets/events/quotation_marks.svg";

            quote.appendChild(quote_image);

            const content = $el("div.content,might-read-more");
            const text_arr = event["Reviews / Feedback"].split("<br>");

            text_arr.forEach((str, i) => {
                const paragraph = $el("p");

                paragraph.textContent =
                    (i === 0 ? "“" : "") +
                    str +
                    (i === text_arr.length - 1 ? "”" : "");

                content.appendChild(paragraph);
            });

            quote.appendChild(content);
            article.appendChild(quote);
        }

        // Media and carousel
        if (has_media) {
            const media_items = await generate_carousel_items({
                files,
                carousel_item_class_name: "postcard toggle-fullscreen",
                random_rotation_strength: 2
            });

            // Set article background using the first available image
            const background_image = media_items.find(
                item => item.tagName === "IMG"
            );

            if (background_image) {
                article.classList.add("custom-background");

                article.style.setProperty(
                    "--src",
                    `url("${background_image.src}")`
                );
            }

            const media = $el("div.media");
            const carousel = $el("div.carousel,custom-scrollbar,scroll-draggable");

            carousel.appendChildren(...media_items);
            media.appendChild(carousel);

            container.appendChild(media);
        }

        generated_events.push(container);

        // Maintain the minimum interval between the first five events
        if (index < 4) {
            const remaining = interval - (performance.now() - event_start);

            if (remaining > 0) {
                await new Promise(resolve => setTimeout(resolve, remaining));
            }
        }
    }

    return generated_events;
}

async function main() {
    const events_obj = await fetch_events();
    const events_container = $(".events")[0];
    const banner = $(".banner")[0];
    const main_el = $("main")[0];
    const timeline = $(".timeline")[0];

    resize_timeline_svg(timeline);

    const package_colours = [
        {package: "Fiddler and Caller", colour: "#C0A4EF"}, 
        {package: "2-piece and caller", colour: "#DE5959"}, 
        {package: "3-piece and caller", colour: "#FFD78D"}, 
        {package: "4-piece and caller", colour: "#FFA88D"}, 
        {package: "Bluegrass and caller", colour: "#82FFF0"}
    ];

    await generate_events(
        events_obj,
        package_colours,
        events_container
    );

    generate_background(0.3, [events_container], null, false);

    let events = $(".event");
    const media = $(".media");
    const original_padding_top = getComputedStyle(main_el).getPropertyValue("--padding-top");
    const scroll_height = (document.documentElement.clientHeight - banner.getBoundingClientRect().bottom - 100);
    banner.classList.add("minimise"); banner.style.transitionDuration = "0ms";
    events_container.style.setProperty("--max-height", scroll_height + "px");
    events_container.style.setProperty("--extra-overflow", events[events.length - 1].offsetHeight + "px");
    banner.classList.remove("minimise");

    fullscreen_img_container_logic();

    banner.style.transitionDuration = "";

    let banner_first_minimised = false;

    events_container.addEventListener("scroll", (e) => {
        if(events_container.scrollTop > 0) {
            banner_first_minimised = true;
            main_el.style.setProperty("--padding-top", banner.getBoundingClientRect().bottom + "px");
            banner.classList.add("minimise");
        } else if (!banner_first_minimised) {
            main_el.style.setProperty("--padding-top", original_padding_top);
            banner.classList.remove("minimise")
        }
        update_relative_index(events, focused_event_index);
        if(event_expanded) {
            events_container.style.setProperty("--scroll-snap-type", "y mandatory");
        }
    })

    update_timeline(events);

    events.forEach((event, index) => {
        const update_height = () => {
            event.style.setProperty("--scroll-height", `${event.scrollHeight}px`);
        };

        event.addEventListener("click", async (e) => {
            const is_expanded = !event.classList.contains("expanded");
            const read_more = e.target.closest(".read-more");
            if (is_expanded) {
                focused_event_index = index;
                update_relative_index(events, focused_event_index);
                event.classList.add("expanded");
                await focus_event(events, focused_event_index, 0, events_container, event);
            } else if(read_more) {
                read_more.classList.toggle("expanded");
                setTimeout(() => {
                    correct_scroll_top(event, events_container)
                }, 250);
                setTimeout(() => {
                    update_height();
                }, 500);
            } else {
                event.classList.remove("expanded");
                regenerate_iframes_after_minimising(event)
                event_expanded = false;
                events_container.style.setProperty("--scroll-snap-type", "y mandatory");
                read_more?.classList.remove("expanded");
                setTimeout(() => {
                    update_timeline(events);
                }, 250);
            }

            handle_click_event(event, is_expanded, events_container, events);
        });

        let scroll_tolerance = 2;
        let scroll_timeout;
        let boundary_scroll_state = null;
        let boundary_detected_this_gesture = false;
        let boundary_check_id = 0;
        let last_wheel_direction = 0;

        event.addEventListener("wheel", (e) => {
            clearTimeout(scroll_timeout);

            const direction = Math.sign(e.deltaY);
            const check_id = ++boundary_check_id;

            update_height();

            if (direction && last_wheel_direction && direction !== last_wheel_direction || e.target.closest(".media")) {
                boundary_scroll_state = null;
                boundary_detected_this_gesture = false;
            }
            if (direction) last_wheel_direction = direction;

            if (!event.classList.contains("expanded")) {
                boundary_scroll_state = null;
                boundary_detected_this_gesture = false;
                last_wheel_direction = 0;
            } else if (direction) {
                const boundary = get_outward_boundary(event, direction, scroll_tolerance);

                if (boundary) {
                    if (!boundary_detected_this_gesture) {
                        boundary_detected_this_gesture = true;

                        const result = process_boundary_scroll(
                            boundary_scroll_state,
                            event,
                            boundary,
                            direction,
                            index,
                            events.length
                        );

                        boundary_scroll_state = result.state;

                        if (result.action === "collapse") {
                            // Let the same wheel event bubble to .events, which moves focus once.
                            collapse_expanded_event(event, events_container, events, timeouts);
                        }
                    }
                } else {
                    // The wheel event runs before native scrolling. Check the resulting scrollTop
                    // on the next frame so the input that reaches an edge is counted as the first one.
                    boundary_scroll_state = null;
                    requestAnimationFrame(() => {
                        if (
                            check_id !== boundary_check_id ||
                            !event.classList.contains("expanded")
                        ) return;

                        const reached_boundary = get_outward_boundary(event, direction, scroll_tolerance);
                        if (!reached_boundary) return;

                        const result = process_boundary_scroll(
                            null,
                            event,
                            reached_boundary,
                            direction,
                            index,
                            events.length
                        );

                        boundary_scroll_state = result.state;
                        boundary_detected_this_gesture = true;
                    });
                }
            }

            scroll_timeout = setTimeout(() => {
                boundary_detected_this_gesture = false;
            }, 100);
        });
    });

    let focused_event_index = 0;
    let await_scroll = false;
    let timeouts = [];
    update_relative_index(events, focused_event_index);

    setTimeout(() => {
        update_timeline(events)
    }, 250);

    focus_event(events, focused_event_index, 0, events_container);

    activate(timeline_svg);

    if(!is_mobile) initialise_scroll_draggable();
    
    let scroll_center = 1/2 * ($(".banner")[0].getBoundingClientRect().bottom + document.documentElement.clientHeight);
    let scroll_tolerance = 2;

    if (supports_scrollsnapchange = "onscrollsnapchanging" in window) {
        let touch_start_y = null;
        let touch_event = null;
        let touch_direction = 0;
        let boundary_scroll_state = null;
        let boundary_detected_this_gesture = false;
        let gesture_boundary = null;

        events_container.addEventListener("touchstart", (e) => {
            touch_start_y = e.touches[0].clientY;
            touch_event = Array.from(events).find(el => el.classList.contains("expanded")) || null;
            touch_direction = 0;
            boundary_detected_this_gesture = false;

            if (!touch_event) {
                boundary_scroll_state = null;
                gesture_boundary = null;
                return;
            }

            const max_scroll_top = Math.max(0, touch_event.scrollHeight - touch_event.clientHeight);
            gesture_boundary = {
                el: touch_event,
                at_top: touch_event.scrollTop <= scroll_tolerance,
                at_bottom: touch_event.scrollTop >= max_scroll_top - scroll_tolerance
            };

            if (boundary_scroll_state && boundary_scroll_state.el !== touch_event) {
                boundary_scroll_state = null;
            }
        }, { passive: true });

        const handle_snap_touch_end = () => {
            // If this gesture reached an edge from within the content, record it here.
            // The next outward gesture can then collapse the card.
            if (
                !boundary_detected_this_gesture &&
                touch_event?.classList.contains("expanded") &&
                touch_direction
            ) {
                const boundary = get_outward_boundary(touch_event, touch_direction, scroll_tolerance);

                if (boundary && !e.target.closest(".media")) {
                    const result = process_boundary_scroll(
                        boundary_scroll_state,
                        touch_event,
                        boundary,
                        touch_direction,
                        Array.from(events).indexOf(touch_event),
                        events.length
                    );

                    boundary_scroll_state = result.state;

                    if (result.action === "collapse") {
                        collapse_expanded_event(touch_event, events_container, events, timeouts);
                    }
                } else {
                    boundary_scroll_state = null;
                }
            }

            touch_start_y = null;
            touch_event = null;
            touch_direction = 0;
            gesture_boundary = null;
            boundary_detected_this_gesture = false;
        };

        const reset_snap_touch_gesture = () => {
            touch_start_y = null;
            touch_event = null;
            touch_direction = 0;
            gesture_boundary = null;
            boundary_detected_this_gesture = false;
        };

        events_container.addEventListener("touchmove", (e) => {
            if (touch_start_y === null) return;

            const delta_y = touch_start_y - e.touches[0].clientY;
            if (Math.abs(delta_y) < 3) return;

            if (!touch_direction) touch_direction = Math.sign(delta_y);
            if (!gesture_boundary || boundary_detected_this_gesture) return;

            const { el, at_top, at_bottom } = gesture_boundary;
            const boundary =
                (touch_direction < 0 && at_top) ? "top" :
                (touch_direction > 0 && at_bottom) ? "bottom" : null;

            if (!boundary) {
                boundary_scroll_state = null;
                return;
            }

            boundary_detected_this_gesture = true;

            if(e.target.closest(".media")) {
                boundary_scroll_state = null;
                return;
            };

            const result = process_boundary_scroll(
                boundary_scroll_state,
                el,
                boundary,
                touch_direction,
                Array.from(events).indexOf(el),
                events.length
            );

            boundary_scroll_state = result.state;

            if (result.action === "collapse") {
                collapse_expanded_event(el, events_container, events, timeouts);
            }
        }, { passive: true });

        events_container.addEventListener("touchend", handle_snap_touch_end, { passive: true });
        events_container.addEventListener("touchcancel", reset_snap_touch_gesture, { passive: true });
        events_container.addEventListener("scrollsnapchanging", async (e) => {
            const snap_index = Array.from(events_container.querySelectorAll(".event-container")).indexOf(e.snapTargetBlock);
            if (boundary_scroll_state && boundary_scroll_state.el !== e.snapTargetBlock) {
                boundary_scroll_state = null;
            }
            focused_event_index = snap_index;

            try {
                await focus_event(
                    events,
                    focused_event_index,
                    0,
                    events_container,
                    null,
                    prevent_scroll = false
                );

                update_timeline(events);
            } finally {
                const focused_el = Array.from(events).find(el =>
                    el.classList.contains("focused")
                );

                const timeout_id = setTimeout(() => {
                    if (focused_el.classList.contains("focused")) {
                        focused_el.classList.add("expanded");
                        handle_click_event(
                            focused_el,
                            true,
                            events_container,
                            events,
                            prevent_scroll = false
                        );
                    }
                }, 4000);

                timeouts.push({ el: focused_el, timeout_id: timeout_id });
                await_scroll = false;
            }
        });
    } else {
        let touch_start_y = null;
        let touch_event = null;
        let scroll_direction = 0;
        let boundary_scroll_state = null;
        let boundary_detected_this_gesture = false;

        events_container.addEventListener("touchstart", (e) => {
            touch_start_y = e.touches[0].clientY;
            touch_event = Array.from(events_container.querySelectorAll(".event-container")).find(el => el.classList.contains("expanded")) || null;
            scroll_direction = 0;
            boundary_detected_this_gesture = false;

            if (!touch_event || (boundary_scroll_state && boundary_scroll_state.el !== touch_event)) {
                boundary_scroll_state = null;
            }
        }, { passive: true });

        const handle_fallback_touch_end = () => {
            // Record a boundary reached during this gesture, even if it was not at the edge on touchstart.
            if (
                !boundary_detected_this_gesture &&
                touch_event?.classList.contains("expanded") &&
                scroll_direction
            ) {
                const boundary = get_outward_boundary(touch_event, scroll_direction, scroll_tolerance);

                if (boundary && !e.target.closest(".media")) {
                    const result = process_boundary_scroll(
                        boundary_scroll_state,
                        touch_event,
                        boundary,
                        scroll_direction,
                        Array.from(events).indexOf(touch_event),
                        events.length
                    );

                    boundary_scroll_state = result.state;

                    if (result.action === "collapse") {
                        collapse_expanded_event(touch_event, events_container, events, timeouts);
                    }
                } else {
                    boundary_scroll_state = null;
                }
            }

            touch_start_y = null;
            touch_event = null;
            scroll_direction = 0;
            boundary_detected_this_gesture = false;
        };

        const reset_fallback_touch_gesture = () => {
            touch_start_y = null;
            touch_event = null;
            scroll_direction = 0;
            boundary_detected_this_gesture = false;
        };

        events_container.addEventListener("touchmove", (e) => {
            if (touch_start_y === null) return;

            const delta_y = touch_start_y - e.touches[0].clientY;

            if (!scroll_direction && Math.abs(delta_y) > 2) {
                scroll_direction = Math.sign(delta_y);
            }

            if (!scroll_direction || boundary_detected_this_gesture) return;

            const expanded_el = Array.from(events).find(el => el.classList.contains("expanded"));

            if (!expanded_el) {
                boundary_scroll_state = null;
                return;
            }

            const boundary = get_outward_boundary(expanded_el, scroll_direction, scroll_tolerance);

            if (!boundary || e.target.closest(".media")) {
                boundary_scroll_state = null;
                return;
            }

            boundary_detected_this_gesture = true;

            const result = process_boundary_scroll(
                boundary_scroll_state,
                expanded_el,
                boundary,
                scroll_direction,
                Array.from(events).indexOf(expanded_el),
                events.length
            );

            boundary_scroll_state = result.state;

            if (result.action === "collapse") {
                collapse_expanded_event(expanded_el, events_container, events, timeouts);
            }
        }, { passive: true });

        events_container.addEventListener("touchend", handle_fallback_touch_end, { passive: true });
        events_container.addEventListener("touchcancel", reset_fallback_touch_gesture, { passive: true });

        window.addEventListener("touchmove", async (e) => {
            let i = find_closest_el(events, scroll_center);

            if (i === focused_event_index) return;

            focused_event_index = i;

            try {
                await focus_event(
                    events,
                    focused_event_index,
                    0,
                    events_container,
                    null,
                    prevent_scroll = true
                );

                update_timeline(events);
            } finally {
                const focused_el = Array.from(events).find(el =>
                    el.classList.contains("focused")
                );

                const timeout_id = setTimeout(() => {
                    if (focused_el.classList.contains("focused")) {
                        focused_el.classList.add("expanded");
                        handle_click_event(
                            focused_el,
                            true,
                            events_container,
                            events
                        );
                    }
                }, 1000);

                timeouts.push({ el: focused_el, timeout_id: timeout_id });
                await_scroll = false;
            }
        });
    }

    window.addEventListener("keydown", async (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

        const direction = e.key === "ArrowUp" ? -1 : 1;
        const next_index = Math.min(
            Math.max(0, focused_event_index + direction),
            events.length - 1
        );

        if (next_index === focused_event_index) return;

        await_scroll = true;
        focused_event_index = next_index;


        try {
            await focus_event(events, focused_event_index, direction, events_container);
            update_timeline(events);
        } finally {
            const focused_el = Array.from(events).find(el => el.classList.contains("focused"));
            const timeout_id = setTimeout(() => {
                if(focused_el.classList.contains("focused")) {
                    focused_el.classList.add("expanded");

                    handle_click_event(focused_el, true, events_container, events);
                }
            }, 1000);
            timeouts.push({el: focused_el, timeout_id: timeout_id});
            await_scroll = false;
        }
    });

    events_container.addEventListener("wheel", async (e) => {
        const closest_event = e.target.closest(".event");

        if (closest_event?.classList.contains("expanded")) {
            return;
        }

        if(e.target.closest(".media")) return;

        events.forEach(event => {
            if (!event.classList.contains("expanded")) return;

            event.classList.remove("expanded");
            handle_click_event(event, false, events_container, events);

            regenerate_iframes_after_minimising(event);
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
            await focus_event(events, focused_event_index, direction, events_container);
            update_timeline(events);
        } finally {
            const focused_el = Array.from(events).find(el => el.classList.contains("focused"));
            const timeout_id = setTimeout(() => {
                if(focused_el.classList.contains("focused")) {
                    focused_el.classList.add("expanded");
                    handle_click_event(focused_el, true, events_container, events);
                }
            }, 1000);
            timeouts.push({el: focused_el, timeout_id: timeout_id});
            await_scroll = false;
        }
    }, { passive: false });
}

function find_closest_el(els, target_y) {
    let closest_index = null;
    let closest_distance = Infinity;

    els.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const el_y = rect.bottom;
        const distance = Math.abs(el_y - target_y);

        if (distance < closest_distance && !el.classList.contains("filler-el")) {
            closest_distance = distance;
            closest_index = i;
        }
    });

    return closest_index;
}

promise__initial_page_rendering.then(() => main())