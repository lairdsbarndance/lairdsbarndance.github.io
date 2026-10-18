async function generate_packages(packages_obj, events_obj, images_per_package, videos_per_package) {
    const packages_container = $(".packages")[0];
    const leather_colours = ["#4F3B53", "#4D2F1F", "#6E3628", "#673F2E", "#0C464C"];

    packages_obj.forEach((package_obj, index) => {
        const events = events_obj
            .filter(event =>
                event["Band Type"] === package_obj.heading &&
                event.files?.length > 0
            )
            .map(event => [...event.files].sort((a, b) =>
                parse_gb_date(b.folder.split("root/")[1].split(" ")[0]) -
                parse_gb_date(a.folder.split("root/")[1].split(" ")[0])
            ));

        const files = [];
        let images_count = 0;
        let videos_count = 0;
        let added_files = true;

        while (
            added_files &&
            (images_count < images_per_package ||
                videos_count < videos_per_package)
        ) {
            added_files = false;

            events.forEach(event_files => {
                if (
                    images_count >= images_per_package &&
                    videos_count >= videos_per_package
                ) return;

                const file_index = event_files.findIndex(obj => {
                    const is_video = obj.mime_type.includes("video");
                    const is_image = obj.mime_type.includes("image");

                    if (is_video) return videos_count < videos_per_package;
                    if (is_image) return images_count < images_per_package;

                    return false;
                });

                if (file_index === -1) return;

                const obj = event_files.splice(file_index, 1)[0];
                const is_video = obj.mime_type.includes("video");

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

        files.sort((a, b) =>
            Number(a.mime_type.includes("video")) -
            Number(b.mime_type.includes("video"))
        );

        const package_el = generate_package(
            package_obj,
            files,
            leather_colours[index % leather_colours.length]
        );

        packages_container.appendChild(package_el);
    });

    return Promise.resolve();
}

function generate_package(package_obj, files, leather_colour = "#3f3042") {
    const package_el = $el(".package");
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

    front.appendChildren(front_heading, front_img);

    // Left panel
    const left = $el(".left,leather");
    left.dataset.leatherColor = leather_colour;

    const left_btn = $el("button.left-btn");
    const left_arrow = $el("img");
    left_arrow.src = "/assets/arrow.png";
    left_arrow.alt = "Previous image";
    left_btn.appendChild(left_arrow);

    const custom_content = $el(".custom,content");
    const plastic_overlay = $el(".plastic-overlay");
    const carousel = $el(".carousel-container");

    files.forEach(file => {
        const carousel_item = $el(".carousel-item");
        const is_video = file.mime_type?.startsWith("video/");
        const media = is_video ? $el("iframe") : $el("img");

        media.src = is_video
            ? `https://drive.google.com/file/d/${file.file_id}/preview`
            : `https://lh3.googleusercontent.com/d/${file.file_id}`;

        if (is_video) {
            if (file.width && file.height) {
                carousel_item.style.aspectRatio = `${file.width} / ${file.height}`;
            }

            media.allow = "autoplay";
            media.allowFullscreen = true;
            media.loading = "lazy";
        } else {
            media.alt = "";
            media.loading = "lazy";
        }

        carousel_item.appendChild(media);
        carousel.appendChild(carousel_item);
    });

    custom_content.appendChildren(plastic_overlay, carousel);

    const right_btn = $el("button.right-btn");
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
    booking_link.href =
        `/pages/contact.html?selected_package=${encodeURIComponent(package_obj.tag)}`;
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
    
    const events_obj = await fetch_events();
    await generate_packages(f_packages, events_obj, get_website_variable("Images per package"), get_website_variable("Videos per package"))
    fade_in(h4);
    
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
            10,
            package_el.querySelector(".front > .content")
        );

        const measure_clone = create_measure_clone(package_clone);

        relative_container.appendChild(measure_clone);

        // fix_size(package_clone.querySelector(".right > .content"), 5, measure_clone.querySelector(".right > .content"))

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

        carousel.style.setProperty("--carousel-item-width", (carousel.offsetWidth * 0.9) + "px")

        let scroll_index = 1;
        carousel.scrollLeft += (carousel_items[scroll_index].getBoundingClientRect().left - carousel.getBoundingClientRect().left) * -1; 
        // * -1 since position is calculated before opening (hence the carousel is flipped; has negative coordinates)

        left_container.addEventListener("click", e => {scroll_index = handle_carousel(carousel, carousel_items, e, scroll_index)});
    }

    function create_measure_clone(package_clone) {
        const measure_clone = package_clone.cloneNode(true);
        measure_clone.classList.add("open");

        Object.assign(measure_clone.style, {
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
        const measure_left = measure_clone.querySelector(".left");
        const measure_right = measure_clone.querySelector(".right");

        let width = measure_left.offsetWidth + measure_right.offsetWidth;
        let height = Math.max(measure_turnable.offsetHeight, measure_right.offsetHeight);

        const banner_bottom = Math.max(
            document.querySelector(".banner").getBoundingClientRect().bottom,
            0
        );

        if ((measure_left.offsetWidth / height) > min_aspect_ratio) {
            package_clone.style.left = `${(relative_container.clientWidth - width) / 2 + measure_left.offsetWidth}px`;
            package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height) / 2}px`;
            package_clone.querySelector(".front").style.height = height + "px";
        } else {
            position_package_clone_vertical(package_el, package_clone, measure_left, measure_right, banner_bottom);
        }

        measure_clone.remove();
    }

    function position_package_clone_vertical(package_el, package_clone, measure_left, measure_right, banner_bottom) {
        package_clone.classList.add("vertical");

        const width = measure_left.offsetWidth * 2;
        const height = measure_right.offsetHeight;

        package_clone.style.left = `${(relative_container.clientWidth - width) / 2}px`;
        package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height + measure_left.offsetHeight + header.offsetHeight) / 2}px`;

        fix_size(
            package_clone.querySelector(".front > .content"),
            1,
            package_el.querySelector(".front > .content")
        );
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
                relative_container.innerHTML = "";
            }, 1000);
        });
    }

    function handle_carousel(carousel, carousel_items, e, scroll_index) {
        scroll_index += e.target.closest("button").classList.contains("left-btn") ? -1 : 1;
        scroll_index = (scroll_index + carousel_items.length) % carousel_items.length;
        scroll_to_carousel_el(carousel, carousel_items[scroll_index]);
        return scroll_index;
    }

    generate_leather(packages_container.querySelectorAll(".leather"))
    .then(() => {
        packages.forEach(initialise_package);
        generate_background();
    })
}

promise__initial_page_rendering.then(() => main());