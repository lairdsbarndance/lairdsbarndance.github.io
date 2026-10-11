async function main() {
    const h4 = $(".page-top-description")[0];
    const packages_res = await fetch_data("packages");
    const packages_obj = parse_document(packages_res);
    h4.innerHTML = packages_obj.find(el => el.heading === "General Information")["content"][0];
    
    const f_packages = packages_obj.filter(el => el.heading !== "General Information");
    console.log(f_packages);

    // generate packages here

    generate_background();
    fade_in(h4);

    const packages = $(".package");
    const fullscreen_container = $(".fullscreen-package-container")[0];
    const relative_container = $(".relative-container")[0];
    const strength = 10; // Maximum rotation in degrees

    packages.forEach(package => {
        package.style.setProperty("--front-width", package.querySelector(".turnable > .front").offsetWidth + "px");
        package.style.setProperty("--front-height", package.querySelector(".turnable > .front").offsetHeight + "px");

        const original_transition = "top calc(1s * var(--package-animation-speed)) ease, left calc(1s * var(--package-animation-speed)) ease"

        let is_open = false;
        package.addEventListener("mouseenter", () => {
            package.style.transition = ["transform 250ms ease", original_transition].join(",");

            setTimeout(() => {
                package.style.transition = original_transition;
            }, 250);
        });

        package.addEventListener("mousemove", e => {
            const {x, y} = package.getBoundingClientRect();

            const mouse_x = (e.clientX - x) / package.offsetWidth;
            const mouse_y = (e.clientY - y) / package.offsetHeight;

            const rotate_x = (0.5 - mouse_y) * strength;
            const rotate_y = (mouse_x - 0.5) * strength;

            package.style.transform = `
                perspective(750px)
                rotateX(${rotate_x}deg)
                rotateY(${rotate_y}deg)
            `;
        });

        package.addEventListener("mouseleave", () => {
            package.style.transition = ["transform 250ms ease", original_transition].join(",");
            package.style.transform = `
                    perspective(750px)
                    rotateX(0deg)
                    rotateY(0deg)
            `;
        });

        package.addEventListener("click", () => {
            package.classList.toggle("open");
            is_open = package.classList.contains("open");
            if(is_open) {
                package.style.transition = ["transform 250ms ease", original_transition].join(",");
                package.style.transform = `
                    perspective(750px)
                    rotateX(0deg)
                    rotateY(0deg)
                `;

                const {x, y} = package.getBoundingClientRect();
                const package_clone = package.cloneNode(true);
                relative_container.innerHTML = "";
                relative_container.appendChild(package_clone);

                Object.assign(package_clone.style, {
                    top: Math.ceil(y) + "px",
                    left: Math.ceil(x) + "px"
                })

                // Measure the final dimensions without animating the visible clone.
                const measure_clone = package_clone.cloneNode(true);
                measure_clone.classList.add("open");

                Object.assign(measure_clone.style, {
                    position: "absolute",
                    visibility: "hidden",
                    transition: "none",
                    animation: "none",
                    left: "0px",
                    top: "0px"
                });

                relative_container.appendChild(measure_clone);

                const measure_turnable = measure_clone.querySelector(".turnable");
                const measure_left = measure_clone.querySelector(".left");
                const measure_right = measure_clone.querySelector(".right");

                const width = measure_left.offsetWidth + measure_right.offsetWidth;
                const height = Math.max(measure_turnable.offsetHeight, measure_right.offsetHeight);

                const banner_bottom = Math.max(document.querySelector(".banner").getBoundingClientRect().bottom, 0);

                package_clone.style.left = `${(relative_container.clientWidth - width) / 2 + measure_left.offsetWidth}px`;
                package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height) / 2}px`;

                measure_clone.remove();

                activate(fullscreen_container, 0);

                package_clone.onclick = () => {
                    const is_open = package_clone.classList.contains("open");

                    package_clone.classList.remove("open", "close");
                    void package_clone.offsetWidth;
                    package_clone.classList.add(is_open ? "close" : "open");

                    if(is_open) {
                        package.classList.remove("open");

                        package_clone.style.left = `${Math.ceil(x)}px`;
                        package_clone.style.top = `${Math.ceil(y)}px`;

                        package_clone.querySelector(".right").onanimationend = () => {
                            deactivate(fullscreen_container, 250);
                            package_clone.onclick = "";
                        };
                    }
                };
            }
        })
    });
}

promise__initial_page_rendering.then(() => main());