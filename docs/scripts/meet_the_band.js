async function generate_member(obj, biography_length, img_max_width) {
    const member_container = $el("article.band-member");
    const name = $el("h3.name");
    name.textContent = `${obj["Name"]} - ${obj["Member Type"] !== "Musician" ? obj["Member Type"].toLowerCase() : obj["Instrument"].toLowerCase()}`;

    const img = $el("img");
    try {
        img.src = await fetch_image(
            obj["Image URL (Autofilled)"].split("id=").pop(),
            img_max_width === undefined ? {} : {max_width: img_max_width}
        );
    } catch (err) {
        console.warn("Reverting to Local Image Backup");
        img.src = `/assets/meet_the_band_backup/${obj["Name"]}.png`;
    }

    const par = $el("p");
    par.textContent = biography_length !== "long" ? obj["Shortened Biography"] : obj["Biography"];

    member_container.appendChildren(name, img, par);

    await new Promise(resolve => {
        if (img.complete) return resolve();
        img.addEventListener("load", resolve, {once: true});
        img.addEventListener("error", resolve, {once: true});
    });

    return {member_container, par, img};
}

async function main() {
    const members_res = await fetch_data("band_members");
    const members_obj = parse_table(members_res);
    const biography_length = await get_website_variable("Biography Length");
    const carousel_mode = String(
        await get_website_variable("Meet the Band Carousel Mode")
    ).trim().toLowerCase();

    const band_container = $(".band")[0];

    const interactive_container = $el(".interactive-container");
    band_container.appendChild(interactive_container);

    const band_sub_container = $el(".wrapper");
    interactive_container.appendChild(band_sub_container);

    let max_img_width;
    let next_member = 0;
    const ready_members = new Map();

    function append_ready_members() {
        while (ready_members.has(next_member)) {
            const {obj, member_container, par} = ready_members.get(next_member);
            ready_members.delete(next_member);
            next_member++;
            par.dataset.memberIndex = next_member - 1;
            band_sub_container.appendChild(member_container);
        }
    }

    const first_member = members_obj[0];

    if (first_member) {
        const {member_container, par, img} = await generate_member(
            first_member,
            biography_length,
            undefined
        );

        par.dataset.memberIndex = 0;

        band_sub_container.appendChild(member_container);
        void member_container.offsetWidth;

        max_img_width = img.offsetWidth;
        next_member = 1;

        ready_members.set(0, {
            obj: first_member,
            member_container,
            par
        });

        append_ready_members();
    }

    await Promise.all(members_obj.slice(1).map(async (obj, i) => {
        const {member_container, par} = await generate_member(
            obj,
            biography_length,
            max_img_width
        );

        ready_members.set(i + 1, {
            obj,
            member_container,
            par
        });

        append_ready_members();
    }));

    if (!members_obj.length) return;

    const clone__band_sub_container = band_sub_container.cloneNode(true);
    interactive_container.appendChild(clone__band_sub_container);

    const pars = band_container.querySelectorAll("p");

    pars.forEach(par => {
        if (biography_length === "long") {
            par.style.overflowY = "auto";

            void par.offsetHeight;

            if (par.scrollHeight > par.offsetHeight) {
                par.classList.add("read-more");
                par.style.setProperty(
                    "--max-lines",
                    parseInt(
                        getComputedStyle(par).getPropertyValue("--max-lines")
                    ) + 1
                );
            }

            par.style.overflowY = "hidden";
        }
    })

    const band_member_els = band_container.querySelectorAll(".band-member");
    const document_width = document.documentElement.clientWidth;
    const styles_intensity = .5;

    function update_styles() {
        band_member_els.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const offset = rect.left + rect.width / 2 - document_width / 2;
            const distance = Math.min(Math.abs(offset) * styles_intensity / (document_width / 2), 1);
            const interpolated_val = (1 + Math.cos(distance * Math.PI)) / 2;

            el.style.opacity = Math.min(1, interpolated_val + 0.25);
            el.style.transform = `perspective(500px) rotateY(${scale_val(interpolated_val, 10 / styles_intensity, 0) * Math.sign(offset)}deg) scale(${scale_val(interpolated_val, 0.4 / styles_intensity, 1)})`;
        });

        requestAnimationFrame(update_styles);
    }

    requestAnimationFrame(update_styles);

    generate_background();

    const carousel_interval =
        Number(await get_website_variable("Band Carousel Speed")) * 1000;

    const carousel_gap = parseFloat(
        getComputedStyle(band_sub_container).columnGap
    ) || 0;

    const tolerance = 1;

    const repeat_width =
        clone__band_sub_container.getBoundingClientRect().left -
        band_sub_container.getBoundingClientRect().left;

    // Centre the first member before activating the container.
    const container_width = interactive_container.clientWidth;

    const first_member_offset =
        band_sub_container.children[0].getBoundingClientRect().left -
        band_sub_container.getBoundingClientRect().left;

    interactive_container.scrollTo({
        left: repeat_width +
            first_member_offset +
            band_sub_container.children[0].offsetWidth / 2 -
            container_width / 2,
        behavior: "instant"
    });

    // Keep the carousel within its repeating scrollable range.
    interactive_container.addEventListener("scroll", () => {
        const scroll_left = interactive_container.scrollLeft;

        const max_scroll_left =
            interactive_container.scrollWidth -
            interactive_container.clientWidth;

        if (scroll_left >= max_scroll_left - tolerance) {
            interactive_container.scrollTo({
                left: scroll_left - repeat_width,
                behavior: "instant"
            });
        } else if (scroll_left <= tolerance) {
            interactive_container.scrollTo({
                left: scroll_left + repeat_width,
                behavior: "instant"
            });
        }
    });

    if (carousel_mode === "continuous") {
        interactive_container.style.scrollBehavior = "auto";
    }

    activate(interactive_container);

    // Interactivity and automatic scrolling.
    let interval_id = null;
    let animation_frame_id = null;
    let interaction_timeout_id = null;
    let previous_frame_time = null;
    let carousel_index = 0;
    let pointer_is_down = false;
    let pointer_is_inside = false;
    let wheel_target_left = null;
    let wheel_target_reset_timeout_id = null;

    function handle_par(e) {
        const par = e.target.closest("[data-member-index]");

        if (!par || !interactive_container.contains(par)) return;

        const obj = members_obj[Number(par.dataset.memberIndex)];

        par.classList.toggle("expanded");

        if (biography_length === "switch") {
            par.textContent = par.classList.contains("expanded")
                ? obj["Biography"]
                : obj["Shortened Biography"];
        }
    }

    interactive_container.addEventListener("click", handle_par);

    function pause_carousel() {
        if (carousel_mode === "continuous") {
            if (animation_frame_id !== null) {
                cancelAnimationFrame(animation_frame_id);
                animation_frame_id = null;
            }

            // Prevent a large time delta when animation resumes.
            previous_frame_time = null;
        } else if (carousel_mode === "stepped") {
            clearInterval(interval_id);
            interval_id = null;
        }
    }

    function start_carousel() {
        if (carousel_mode === "continuous") {
            if (animation_frame_id === null) {
                previous_frame_time = null;
                animation_frame_id =
                    requestAnimationFrame(animate_continuously);
            }
        } else if (carousel_mode === "stepped") {
            if (interval_id === null) {
                interval_id = setInterval(step_carousel, carousel_interval);
            }
        }
    }

    function handle_user_interaction() {
        pause_carousel();

        clearTimeout(interaction_timeout_id);

        interaction_timeout_id = setTimeout(() => {
            interaction_timeout_id = null;

            if (pointer_is_down || pointer_is_inside) return;

            start_carousel();
        }, 50);
    }

    interactive_container.addEventListener("pointerenter", () => {
        pointer_is_inside = true;

        clearTimeout(interaction_timeout_id);
        interaction_timeout_id = null;

        pause_carousel();
    });

    interactive_container.addEventListener("pointerleave", () => {
        pointer_is_inside = false;
        handle_user_interaction();
    });


    // Mouse wheel and trackpad.
    // Translate ordinary wheel scrolling into horizontal carousel movement.
    interactive_container.addEventListener("wheel", (e) => {
        const horizontal_dominant = Math.abs(e.deltaX) > Math.abs(e.deltaY);

        let delta = horizontal_dominant ? e.deltaX : e.deltaY;

        if (!delta) return;

        // Convert line- and page-based wheel deltas to pixels.
        if (e.deltaMode === 1) {
            delta *= 8;
        } else if (e.deltaMode === 2) {
            delta *= horizontal_dominant
                ? interactive_container.clientWidth
                : interactive_container.clientHeight;
        }

        // Prevent the browser from scrolling the page vertically.
        e.preventDefault();

        // Pause automatic movement and reset the inactivity timeout.
        handle_user_interaction();

        const max_scroll_left =
            interactive_container.scrollWidth -
            interactive_container.clientWidth;

        let desired_left =
            (wheel_target_left ?? interactive_container.scrollLeft) + delta;

        // Wrap the current position instantly when crossing a boundary,
        // then animate towards the adjusted destination.
        while (desired_left >= max_scroll_left - tolerance) {
            interactive_container.scrollTo({
                left: interactive_container.scrollLeft - repeat_width,
                behavior: "instant"
            });

            desired_left -= repeat_width;
        }

        while (desired_left <= tolerance) {
            interactive_container.scrollTo({
                left: interactive_container.scrollLeft + repeat_width,
                behavior: "instant"
            });

            desired_left += repeat_width;
        }

        wheel_target_left = desired_left;

        interactive_container.scrollTo({
            left: desired_left,
            behavior: "smooth"
        });

        // Fallback in case scrollend is unavailable or does not fire.
        clearTimeout(wheel_target_reset_timeout_id);

        wheel_target_reset_timeout_id = setTimeout(() => {
            wheel_target_left = null;
            wheel_target_reset_timeout_id = null;
        }, 1000);

    }, {passive: false});

    // Reset the accumulated target when smooth scrolling finishes.
    interactive_container.addEventListener("scrollend", () => {
        wheel_target_left = null;

        clearTimeout(wheel_target_reset_timeout_id);
        wheel_target_reset_timeout_id = null;
    });

    // Touch screens.
    interactive_container.addEventListener(
        "touchstart",
        handle_user_interaction,
        {passive: true}
    );

    interactive_container.addEventListener(
        "touchmove",
        handle_user_interaction,
        {passive: true}
    );

    // Mouse, pen and touch pointer interactions.
    interactive_container.addEventListener("pointerdown", () => {
        pointer_is_down = true;
        handle_user_interaction();
    });

    interactive_container.addEventListener("pointermove", (e) => {
        if (pointer_is_down && e.buttons) {
            handle_user_interaction();
        }
    });

    function end_pointer_interaction() {
        pointer_is_down = false;
        handle_user_interaction();
    }

    interactive_container.addEventListener(
        "pointerup",
        end_pointer_interaction
    );

    interactive_container.addEventListener(
        "pointercancel",
        end_pointer_interaction
    );

    // Keyboard scrolling, when the container has focus.
    interactive_container.addEventListener("keydown", (e) => {
        if ([
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "PageUp",
            "PageDown",
            "Home",
            "End",
            " "
        ].includes(e.key)) {
            handle_user_interaction();
        }
    });

    // Continuous mode: constant-speed movement using requestAnimationFrame.
    function animate_continuously(timestamp) {
        if (previous_frame_time === null) {
            previous_frame_time = timestamp;
        }

        const elapsed = timestamp - previous_frame_time;
        previous_frame_time = timestamp;

        const pixels_per_ms =
            repeat_width /
            (members_obj.length * Math.max(1, carousel_interval));

        let desired_left =
            interactive_container.scrollLeft +
            pixels_per_ms * elapsed;

        const max_scroll_left =
            interactive_container.scrollWidth -
            interactive_container.clientWidth;

        while (desired_left >= max_scroll_left - tolerance) {
            desired_left -= repeat_width;
        }

        interactive_container.scrollLeft = desired_left;

        animation_frame_id =
            requestAnimationFrame(animate_continuously);
    }

    // Stepped mode: move smoothly between consecutive member centres.
    function step_carousel() {
        const children = Array.from(band_sub_container.children);

        const member_index = carousel_index % children.length;
        const next_index = (member_index + 1) % children.length;

        const current_left = interactive_container.scrollLeft;

        const step =
            children[member_index].offsetWidth / 2 +
            carousel_gap +
            children[next_index].offsetWidth / 2;

        let desired_left = current_left + step;

        const max_scroll_left =
            interactive_container.scrollWidth -
            interactive_container.clientWidth;

        if (desired_left >= max_scroll_left - tolerance) {
            interactive_container.scrollTo({
                left: current_left - repeat_width,
                behavior: "instant"
            });

            desired_left -= repeat_width;
        }

        interactive_container.scrollTo({
            left: desired_left
        });

        carousel_index = (carousel_index + 1) % children.length;
    }

    start_carousel();
}

promise__initial_page_rendering.then(() => main())