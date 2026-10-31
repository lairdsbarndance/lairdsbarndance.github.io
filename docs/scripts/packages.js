async function generate_packages(packages_obj, events_obj, images_per_package, videos_per_package) {
    const packages_container = $(".packages")[0];
    const leather_colours = ["#4F3B53", "#4D2F1F", "#6E3628", "#673F2E", "#0C464C"];

    images_per_package = Math.max(0, Number(images_per_package) || 0);
    videos_per_package = Math.max(0, Number(videos_per_package) || 0);

    const generated_packages = await Promise.all(
        packages_obj.map(async (package_obj, index) => {
            // Get and sort events, newest first.
            const events = events_obj
                .filter(event =>
                    event["Band Type"] === package_obj.heading &&
                    Array.isArray(event.files) &&
                    event.files.length > 0
                )
                .sort((a, b) => {
                    const date_a = parse_gb_date(a.files[0].folder.split("root/")[1].split(" ")[0]);
                    const date_b = parse_gb_date(b.files[0].folder.split("root/")[1].split(" ")[0]);

                    return date_b - date_a;
                })
                .map(event => ({
                    files: [...event.files].sort((a, b) => {
                        const date_a = parse_gb_date(a.folder.split("root/")[1].split(" ")[0]);
                        const date_b = parse_gb_date(b.folder.split("root/")[1].split(" ")[0]);

                        return date_b - date_a;
                    })
                }));

            const files = [];
            let images_count = 0;
            let videos_count = 0;

            // Track the next file to select from each event.
            const event_indices = new Array(events.length).fill(0);

            // Continue until both quotas are fulfilled or no files remain.
            let added_files = true;

            while (
                added_files &&
                (images_count < images_per_package ||
                    videos_count < videos_per_package)
            ) {
                added_files = false;

                events.forEach((event, event_index) => {
                    const event_files = event.files;

                    if (
                        images_count >= images_per_package &&
                        videos_count >= videos_per_package
                    ) return;

                    // Find the next eligible file in this event.
                    let file_index = -1;

                    for (
                        let i = event_indices[event_index];
                        i < event_files.length;
                        i++
                    ) {
                        const mime_type = event_files[i].mime_type || "";

                        const is_image = mime_type.startsWith("image/");
                        const is_video = mime_type.startsWith("video/");

                        if (
                            (is_image && images_count < images_per_package) ||
                            (is_video && videos_count < videos_per_package)
                        ) {
                            file_index = i;
                            break;
                        }
                    }

                    if (file_index === -1) return;

                    const obj = event_files[file_index];

                    // Advance the event's selection position.
                    event_indices[event_index] = file_index + 1;

                    const is_video = obj.mime_type.startsWith("video/");

                    if (is_video) videos_count++;
                    else images_count++;

                    files.push({
                        file_id: obj.file_id,
                        mime_type: obj.mime_type,
                        width: obj.width,
                        height: obj.height
                    });

                    added_files = true;
                });
            }

            // Images first, videos second.
            files.sort((a, b) =>
                Number(a.mime_type.startsWith("video/")) -
                Number(b.mime_type.startsWith("video/"))
            );

            const package_el = await generate_package(
                package_obj,
                files,
                leather_colours[index % leather_colours.length]
            );

            return package_el;
        })
    );

    packages_container.append(...generated_packages);

    return;
}

async function generate_package(package_obj, files, leather_colour = "#3f3042") {
    const package_el = $el(".package,pre-render,no-mask");
    package_el.dataset.packageType = package_obj.heading;

    // Front panel
    const front = $el(".front,leather");
    front.dataset.leatherMaskContent = "true";
    front.dataset.leatherColor = leather_colour;

    const front_heading = $el("h3");
    front_heading.textContent = package_obj.heading;

    const front_img = $el("img");
    front_img.src = `/assets/packages/${package_obj.tag}.png`;
    front_img.alt = package_obj.heading;
    front_img.loading = "lazy";

    front.appendChildren(front_heading, front_img);

    // Left panel
    const left = $el(".left,leather");
    left.dataset.leatherColor = leather_colour;

    const left_btn = $el("button.left-btn");
    left_btn.type = "button";

    const left_arrow = $el("img");
    left_arrow.src = "/assets/arrow.png";
    left_arrow.alt = "Previous image";

    left_btn.appendChild(left_arrow);

    const custom_content = $el(".custom,content");
    const plastic_overlay = $el(".plastic-overlay");
    const carousel = $el(".carousel-container");

    // if(!is_mobile) carousel.classList.add("scroll-draggable");

    // Generate carousel items concurrently.
    
    // files.push({file_id: "test", mime_type: "image/jpeg"})
    const carousel_items = await generate_carousel_items({files: files});
    console.log(carousel_items)
    carousel.append(...carousel_items);

    custom_content.appendChildren(plastic_overlay, carousel);

    const right_btn = $el("button.right-btn");
    right_btn.type = "button";

    const right_arrow = $el("img");
    right_arrow.src = "/assets/arrow.png";
    right_arrow.alt = "Next image";

    right_btn.appendChild(right_arrow);

    left.appendChildren(left_btn, custom_content, right_btn);

    // Right panel
    const right = $el(".right,leather");
    right.dataset.leatherMaskContent = "true";
    right.dataset.leatherColor = leather_colour;

    const heading = $el("h2");
    heading.textContent = package_obj.heading;

    const description = $el(".description,custom-scrollbar");

    package_obj.content.forEach(paragraph => {
        const p = $el("p");
        p.textContent = paragraph;
        description.appendChild(p);
    });

    const accent_btn = $el("button.accent-btn");

    const booking_link = $el("a");
    booking_link.href = `/pages/contact.html?selected_package=${encodeURIComponent(package_obj.tag)}`;
    booking_link.textContent = "Book us";

    accent_btn.appendChild(booking_link);

    right.appendChildren(heading, description, accent_btn);

    // Assemble package
    const turnable = $el(".turnable");
    turnable.appendChildren(front, left);

    package_el.appendChildren(turnable, right);

    return package_el;
}

async function main() {
    const h4 = $(".page-top-description")[0];
    const packages_res = await fetch_data("packages");
    const packages_obj = parse_document(packages_res, null, merge_content = false);
    
    const f_packages = packages_obj.filter(el => el.heading !== "General Information");
    h4.innerHTML = packages_obj.find(el => el.heading === "General Information")["content"].join("<br>");
    fade_in(h4);
    
    const events_obj = await fetch_events();
    const images_per_package = await get_website_variable("Images per package");
    const videos_per_package = await get_website_variable("Videos per package");

    await generate_packages(f_packages, events_obj, images_per_package, videos_per_package)
    
    const packages_container = $(".packages")[0];
    const min_aspect_ratio = parseFloat(packages_container.dataset.minPackageAspectRatio);
    const packages = $(".package");
    const fullscreen_container = $(".fullscreen-package-container")[0];
    const relative_container = $(".relative-container")[0];
    const strength = 10; // Maximum rotation in degrees

    const original_transition = "top calc(1s * var(--package-animation-speed)) ease, left calc(1s * var(--package-animation-speed)) ease";

    function initialise_package(package_el) {
        const front = package_el.querySelector(".turnable > .front");
        package_el.style.setProperty("--front-width", front.offsetWidth + "px");
        package_el.style.setProperty("--front-height", front.offsetHeight + "px");
        
        package_el.addEventListener("mouseenter", () => handle_package_enter(package_el));
        package_el.addEventListener("mousemove", e => handle_package_move(package_el, e));
        package_el.addEventListener("mouseleave", () => handle_package_leave(package_el));
        package_el.addEventListener("click", () => open_package(package_el));
    }

    function handle_package_enter(package_el) {
        package_el.style.transition = ["transform 250ms ease", original_transition].join(",");

        setTimeout(() => {
            package_el.style.transition = original_transition;
        }, 250);
    }

    function handle_package_move(package_el, e) {
        const {x, y} = package_el.getBoundingClientRect();

        const mouse_x = (e.clientX - x) / package_el.offsetWidth;
        const mouse_y = (e.clientY - y) / package_el.offsetHeight;

        const rotate_x = (0.5 - mouse_y) * strength;
        const rotate_y = (mouse_x - 0.5) * strength;

        package_el.style.transform = `
            perspective(750px)
            rotateX(${rotate_x}deg)
            rotateY(${rotate_y}deg)
        `;
    }

    function handle_package_leave(package_el) {
        package_el.style.transition = ["transform 250ms ease", original_transition].join(",");
        reset_package_transform(package_el);
    }

    function reset_package_transform(package_el) {
        package_el.style.transform = `
            perspective(750px)
            rotateX(0deg)
            rotateY(0deg)
        `;
    }

    function open_package(package_el) {
        package_el.classList.toggle("open");

        if (!package_el.classList.contains("open")) return;

        package_el.style.transition = ["transform 250ms ease", original_transition].join(",");
        reset_package_transform(package_el);

        const {x, y} = package_el.getBoundingClientRect();
        const package_clone = package_el.cloneNode(true);

        relative_container.innerHTML = "";
        relative_container.appendChild(package_clone);

        Object.assign(package_clone.style, {
            top: Math.ceil(y) + "px",
            left: Math.ceil(x) + "px"
        });

        fix_size(
            package_clone.querySelector(".front > .content"),
            1,
            package_el.querySelector(".front > .content")
        );

        const measure_clone = create_measure_clone(package_clone);
        const right = measure_clone.querySelector(".right.leather");        

        relative_container.appendChild(measure_clone);

        requestAnimationFrame(() => {
            position_package_clone(package_el, package_clone, measure_clone);
        });

        activate(fullscreen_container, 0);

        fullscreen_container.onclick = e => {
            handle_fullscreen_click(e, package_el, package_clone, x, y);
        };

        const left_container = package_clone.querySelector(".turnable > .left");
        const carousel = left_container.querySelector(".carousel-container");
        const left_btn = left_container.querySelector(".left-btn");
        const right_btn = left_container.querySelector(".right-btn");
        const carousel_items = carousel.querySelectorAll(".carousel-item");

        carousel.style.setProperty("--carousel-item-width", (carousel.offsetWidth * 0.9) + "px");

        requestAnimationFrame(() => {
            package_clone.style.setProperty(
                "--right-content-height",
                package_clone.querySelector(".right.leather").getBoundingClientRect().height + "px"
            );
        })

        let scroll_index = 1;
        carousel.scrollLeft += (carousel_items[scroll_index].getBoundingClientRect().left - carousel.getBoundingClientRect().left) * -1; 
        // * -1 since position is calculated before opening (hence the carousel is flipped; has negative coordinates)

        left_container.addEventListener("click", e => {scroll_index = handle_carousel(carousel, carousel_items, e, scroll_index)});
    }

    function create_measure_clone(package_clone) {
        const measure_clone = package_clone.cloneNode(true);
        measure_clone.classList.add("open");
        measure_clone.classList.add("measure-clone");

        Object.assign(measure_clone.style, {
            visibility: "hidden",
            position: "absolute",
            transition: "none",
            animationDuration: "0s",
            left: "0px",
            top: "0px"
        });

        measure_clone.querySelectorAll("*").forEach(el => {
            el.style.animationDuration = "0s";
            el.style.animationDelay = "0s";
        });

        return measure_clone;
    }

    function position_package_clone(package_el, package_clone, measure_clone) {
        const measure_turnable = measure_clone.querySelector(".turnable");
        const measure_left = measure_clone.querySelector(".left.leather");
        const measure_right = measure_clone.querySelector(".right.leather");

        let width = measure_left.offsetWidth + measure_right.offsetWidth;
        let height = Math.max(measure_turnable.offsetHeight, measure_right.offsetHeight);

        const banner_bottom = Math.max(
            document.querySelector(".banner").getBoundingClientRect().bottom,
            0
        );

        if ((measure_left.offsetWidth / height) > min_aspect_ratio) {
            requestAnimationFrame(() => {
                package_clone.style.setProperty("--right-content-height", measure_right.offsetHeight + "px");
            })
            package_clone.style.left = `${(relative_container.clientWidth - width) / 2 + measure_left.offsetWidth}px`;
            package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height) / 2}px`;
        } else {
            requestAnimationFrame(() => {
                position_package_clone_vertical(package_el, package_clone, measure_left, measure_right, measure_clone, banner_bottom);
            })
        }

        setTimeout(() => {
            measure_clone.remove();
        }, 1000);
    }

    function position_package_clone_vertical(package_el, package_clone, measure_left, measure_right, measure_clone, banner_bottom) {
        package_clone.classList.add("vertical");
        const turnable_height = package_clone.querySelector(".left.leather").offsetHeight;
        const width = measure_left.offsetWidth * 2;
        const height = turnable_height + package_clone.querySelector(".right.leather").offsetHeight;

        package_clone.style.left = `${(relative_container.clientWidth - width) / 2}px`;
        package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height) / 2 + turnable_height}px`;
        console.log(relative_container.clientHeight, banner_bottom, height, turnable_height)
    }

    function handle_fullscreen_click(e, package_el, package_clone, x, y) {
        const close_button = fullscreen_container.querySelector(".close");

        if (
            ![fullscreen_container, relative_container].includes(e.target) &&
            !close_button.contains(e.target)
        ) return;

        const is_open = package_clone.classList.contains("open");

        package_clone.classList.remove("open", "close");
        void package_clone.offsetWidth;
        package_clone.classList.add(is_open ? "close" : "open");

        if (!is_open) return;

        close_package(package_el, package_clone, x, y);
    }

    function close_package(package_el, package_clone, x, y) {
        package_el.classList.remove("open");

        package_clone.style.left = `${Math.ceil(x)}px`;
        package_clone.style.top = `${Math.ceil(y)}px`;

        const animations = [package_clone, ...package_clone.querySelectorAll("*")]
            .flatMap(el => el.getAnimations())
            .map(animation => animation.finished);

        Promise.all(animations).then(() => {
            deactivate(fullscreen_container);
            package_clone.onclick = "";
            setTimeout(() => {
                package_clone.remove();
            }, 1000);
        });
    }

    function handle_carousel(carousel, carousel_items, e, scroll_index) {
        if(!e.target.closest("button")) return scroll_index;
        scroll_index += e.target.closest("button").classList.contains("left-btn") ? -1 : 1;
        scroll_index = (scroll_index + carousel_items.length) % carousel_items.length;
        scroll_to_carousel_el(carousel, carousel_items[scroll_index]);
        return scroll_index;
    }

    generate_leather(packages_container.querySelectorAll(".leather"))
    .then(async () => {
        packages.forEach(initialise_package);
        await generate_background();
        packages.forEach(fade_in)
    })
}

promise__initial_page_rendering.then(() => main());