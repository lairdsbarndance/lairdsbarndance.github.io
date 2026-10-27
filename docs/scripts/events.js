const timeline_svg = $(".timeline")[0];
const is_mobile = (navigator.maxTouchPoints > 0 || 'ontouchstart' in document.documentElement);
let event_expanded = false;

function handle_click_event(event, is_expanded, events_container, events, prevent_scroll = false) {
    const package_type = event.querySelector(".package-type");
    package_type.textContent = package_type.textContent.replace(is_expanded ? "," : ":", is_expanded ? ":" : ",");
    if(is_expanded) {
        event_expanded = true;
        event.style.setProperty("--transition-overflow", "hidden");
        event.scrollTop = 0;
        initialise_read_mores(Array.from(event.querySelectorAll(".quote > .content")));
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
    let scroll_top = target_el.offsetTop - min_height;
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
    const scroll_el = events[0].parentElement;

    events.forEach(el => {
        el.classList.remove("focused");

        if (el !== preserve_event) {
            el.classList.remove("expanded");
            scroll_el.style.setProperty("--scroll-snap-type", "y mandatory");
            handle_click_event(el, false, events_container, events);
        }
    });

    focused_event.classList.add("focused");

    if (!direction || prevent_scroll) return;

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

function update_timeline(events, x_offset = 10, y_offset = 50) {
    const client_height = document.documentElement.clientHeight;
    const top_event = [...Array.from(events)].filter(el => el.getBoundingClientRect().top < 0).pop() || events[0];
    const container_rect = events[0].parentElement.getBoundingClientRect();
    const median_coord = {x: container_rect.left, y: container_rect.top + container_rect.height / 2};
    const bottom_event = [...Array.from(events)].filter(el => el.getBoundingClientRect().bottom > client_height)[0] || events[events.length - 1];

    let top_corners = get_transformed_corners(top_event);
    let bottom_corners = get_transformed_corners(bottom_event);

    if(top_event === events[0]) top_corners.p1.y = top_corners.p1.y - y_offset;
    if(bottom_event === events[events.length - 1]) bottom_corners.p4.y = bottom_corners.p4.y + y_offset;


    const timeline_coords = {
        top: {
            x: top_corners.p1.x + x_offset,
            y: top_corners.p1.y - y_offset
        },
        median: median_coord,
        bottom: {
            x: bottom_corners.p4.x + x_offset,
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

    // generate events here

    let events = $(".event");
    const original_padding_top = getComputedStyle(main_el).getPropertyValue("--padding-top");
    const scroll_height = (document.documentElement.clientHeight - banner.getBoundingClientRect().bottom - 100);
    banner.classList.add("minimise"); banner.style.transitionDuration = "0ms";
    events_container.style.setProperty("--max-height", scroll_height + "px");
    events_container.style.setProperty("--extra-overflow", events[events.length - 1].offsetHeight + "px");
    banner.classList.remove("minimise");
    
    banner.style.transitionDuration = "";

    let banner_first_minimised = false;

    events_container.addEventListener("scroll", (e) => {
        if(events_container.scrollTop > 0) {
            banner_first_minimised = true && is_mobile;
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
        event.addEventListener("click", async (e) => {
            const is_expanded = !event.classList.contains("expanded");
            const read_more = event.querySelector(".read-more")
            let is_read_more = e.target.closest(".read-more");
            if (is_expanded) {
                focused_event_index = index;
                update_relative_index(events, focused_event_index);
                event.classList.add("expanded");
                
                await focus_event(events, focused_event_index, 0, events_container, event);
            } else if(read_more && is_read_more) {
                read_more.classList.toggle("expanded");
                setTimeout(() => {
                    correct_scroll_top(event, events_container)
                }, 250);
            } else {
                event.classList.remove("expanded");
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
        let boundary_scroll_detected = false;
        let boundary_detected_this_gesture = false;

        event.addEventListener("wheel", (e) => {
            clearTimeout(scroll_timeout);

            if (event.classList.contains("expanded")) {
                const at_top =
                    event.scrollTop <= scroll_tolerance && e.deltaY < 0;

                const at_bottom =
                    event.scrollTop >= event.scrollHeight - event.clientHeight - scroll_tolerance &&
                    e.deltaY > 0;

                if ((at_top || at_bottom) && !boundary_detected_this_gesture) {
                    boundary_detected_this_gesture = true;

                    if (boundary_scroll_detected) {
                        
                        focus_event(events, index, Math.sign(e.deltaY), events_container)
                        boundary_scroll_detected = false;
                    } else {
                        boundary_scroll_detected = true;
                    }
                }
            }

            scroll_timeout = setTimeout(() => {
                boundary_detected_this_gesture = false;
            }, 50);
        });
    });

    let focused_event_index = 0;
    let await_scroll = false;
    let timeouts = [];
    update_relative_index(events, focused_event_index);

    focus_event(events, focused_event_index, 0, events_container);

    activate(timeline_svg);
    stagger_activate_els(events, 125);

    let scroll_center = 1/2 * ($(".banner")[0].getBoundingClientRect().bottom + document.documentElement.clientHeight);
    let scroll_tolerance = 2;

    if (supports_scrollsnapchange = "onscrollsnapchanging" in window) {
        let touch_start_y = null;
        let boundary_scroll_el = null;
        let boundary_scroll_detected = false;
        let boundary_detected_this_gesture = false;
        let gesture_boundary = null;

        events_container.addEventListener("touchstart", (e) => {
            touch_start_y = e.touches[0].clientY;
            boundary_detected_this_gesture = false;

            const expanded_el = Array.from(events).find(el =>
                el.classList.contains("expanded")
            );

            if (!expanded_el) {
                boundary_scroll_el = null;
                boundary_scroll_detected = false;
                gesture_boundary = null;
                return;
            }

            if (boundary_scroll_el && boundary_scroll_el !== expanded_el) {
                boundary_scroll_el = null;
                boundary_scroll_detected = false;
            }

            gesture_boundary = {
                el: expanded_el,
                at_top: expanded_el.scrollTop <= scroll_tolerance,
                at_bottom:
                    expanded_el.scrollTop >=
                    expanded_el.scrollHeight -
                    expanded_el.clientHeight -
                    scroll_tolerance
            };
        }, { passive: true });

        events_container.addEventListener("touchmove", (e) => {
            if (
                touch_start_y === null ||
                !gesture_boundary ||
                boundary_detected_this_gesture
            ) return;

            const delta_y = touch_start_y - e.touches[0].clientY;

            if (Math.abs(delta_y) < 3) return;

            const { el, at_top, at_bottom } = gesture_boundary;

            const at_boundary =
                (at_top && delta_y < 0) ||
                (at_bottom && delta_y > 0);

            if (!at_boundary) return;

            boundary_detected_this_gesture = true;

            const events = Array.from(events_container.querySelectorAll(".event"));
            const target_index = events.indexOf(e.target.closest(".event"));
            const direction = Math.sign(delta_y)
            if(!((target_index === 0 && direction === -1) || (target_index === events.length  -1  && direction === 1))) boundary_scroll_detected = false;


            if (boundary_scroll_detected && boundary_scroll_el === el) {
                el.classList.remove("expanded");
                events_container.style.setProperty("--scroll-snap-type", "y mandatory");

                for (let i = timeouts.length - 1; i >= 0; i--) {
                    if (timeouts[i].el === el) {
                        clearTimeout(timeouts[i].timeout_id);
                        timeouts.splice(i, 1);
                    }
                }

                boundary_scroll_detected = false;
                boundary_scroll_el = null;
            } else {
                boundary_scroll_detected = true;
                boundary_scroll_el = el;
            }
        }, { passive: true });

        const reset_touch_gesture = () => {
            touch_start_y = null;
            gesture_boundary = null;
            boundary_detected_this_gesture = false;
        };

        events_container.addEventListener("touchend", reset_touch_gesture, {
            passive: true
        });

        events_container.addEventListener("touchcancel", reset_touch_gesture, {
            passive: true
        });

        events_container.addEventListener("scrollsnapchanging", async (e) => {
            focused_event_index = Array.from(events).indexOf(e.snapTargetBlock);

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
                }, 1000);

                timeouts.push({ el: focused_el, timeout_id: timeout_id });
                await_scroll = false;
            }
        });
    } else {
        let touch_start_y = null;
        let scroll_direction = 0;
        let boundary_scroll_detected = false;
        let boundary_detected_this_gesture = false;

        events_container.addEventListener("touchstart", (e) => {
            touch_start_y = e.touches[0].clientY;
            scroll_direction = 0;
            boundary_detected_this_gesture = false;
        }, { passive: true });

        events_container.addEventListener("touchmove", (e) => {
            if (touch_start_y === null) return;

            const delta_y = touch_start_y - e.touches[0].clientY;

            if (!scroll_direction && Math.abs(delta_y) > 2) {
                scroll_direction = Math.sign(delta_y);
            }

            if (!scroll_direction || boundary_detected_this_gesture) return;

            const expanded_el = Array.from(events).find(el =>
                el.classList.contains("expanded")
            );

            if (!expanded_el) return;

            const at_top = expanded_el.scrollTop <= scroll_tolerance;

            const at_bottom =
                expanded_el.scrollTop >=
                expanded_el.scrollHeight -
                expanded_el.clientHeight -
                scroll_tolerance;

            if (
                (at_top && scroll_direction < 0) ||
                (at_bottom && scroll_direction > 0)
            ) {
                boundary_detected_this_gesture = true;

                if (boundary_scroll_detected) {
                    expanded_el.classList.remove("expanded");
                    events_container.style.setProperty("--scroll-snap-type", "y mandatory");
                    boundary_scroll_detected = false;

                    for (let i = timeouts.length - 1; i >= 0; i--) {
                        if (timeouts[i].el === expanded_el) {
                            clearTimeout(timeouts[i].timeout_id);
                            timeouts.splice(i, 1);
                        }
                    }
                } else {
                    boundary_scroll_detected = true;
                }
            }
        }, { passive: true });

        const reset_touch_gesture = () => {
            touch_start_y = null;
            scroll_direction = 0;
            boundary_detected_this_gesture = false;
        };

        events_container.addEventListener("touchend", reset_touch_gesture, {
            passive: true
        });

        events_container.addEventListener("touchcancel", reset_touch_gesture, {
            passive: true
        });

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

        if (closest_event?.classList.contains("expanded") && closest_event?.scrollHeight > closest_event?.offsetHeight) {
            return;
        }

        events.forEach(event => {
            if (!event.classList.contains("expanded")) return;

            event.classList.remove("expanded");
            handle_click_event(event, false, events_container, events);
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