async function main() {
    const h4 = $(".page-top-description")[0];
    const packages_res = await fetch_data("packages");
    const packages_obj = parse_document(packages_res);
    h4.innerHTML = packages_obj.find(el => el.heading === "General Information")["content"][0];
    
    const f_packages = packages_obj.filter(el => el.heading !== "General Information");
    console.log(f_packages);
    
    const events_obj = await fetch_events();
    console.log(events_obj)
    
    generate_background();
    fade_in(h4);
    
    const packages_container = $(".packages")[0];
    const min_aspect_ratio = parseFloat(packages_container.dataset.minPackageAspectRatio);
    const packages = $(".package");
    const fullscreen_container = $(".fullscreen-package-container")[0];
    const relative_container = $(".relative-container")[0];
    const strength = 10; // Maximum rotation in degrees

    packages.forEach(package => {
        const content_width = package.querySelector(".turnable > .front").offsetWidth;
        package.style.setProperty("--front-width", content_width + "px");
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

                fix_size(package_clone.querySelector(".front > .content"), 5, package.querySelector(".front > .content"));
                
                // Measure the final dimensions without animating the visible clone.
                const measure_clone = package_clone.cloneNode(true);
                measure_clone.classList.add("open");
                
                Object.assign(measure_clone.style, {
                    position: "absolute",
                    transition: "none",
                    animationDuration: "0s",
                    left: "0px",
                    top: "0px"
                });

                measure_clone.querySelectorAll("*").forEach(el => {el.style.animationDuration = "0s"; el.style.animationDelay = "0s"})
                // Instantly determine active scale state
                
                relative_container.appendChild(measure_clone);

                requestAnimationFrame(() => {
                    const measure_turnable = measure_clone.querySelector(".turnable");
                    const measure_left = measure_clone.querySelector(".left");
                    const measure_right = measure_clone.querySelector(".right");

                    let width = measure_left.offsetWidth + measure_right.offsetWidth;
                    let height = Math.max(measure_turnable.offsetHeight, measure_right.offsetHeight);
                    const banner_bottom = Math.max(document.querySelector(".banner").getBoundingClientRect().bottom, 0);

                    if((measure_left.offsetWidth / height) > min_aspect_ratio) {
                        package_clone.style.left = `${(relative_container.clientWidth - width) / 2 + measure_left.offsetWidth}px`;
                        package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height) / 2}px`;
                        package_clone.querySelector(".front").style.height = height + "px";
                    } else {
                        package_clone.classList.add("vertical");
                        width = (measure_left.offsetWidth) * 2;
                        height = measure_right.offsetHeight;
                        console.log(width, height)
                        package_clone.style.left = `${(relative_container.clientWidth - width) / 2}px`;
                        package_clone.style.top = `${banner_bottom + (relative_container.clientHeight - banner_bottom - height + measure_left.offsetHeight + header.offsetHeight) / 2}px`;
                        package_clone.querySelector(".front").style.height = measure_left.offsetHeight + "px";
                    }

                    measure_clone.remove();
                })

                
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