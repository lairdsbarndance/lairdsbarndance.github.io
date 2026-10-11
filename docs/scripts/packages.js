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

        let is_open = false;
        package.addEventListener("mouseenter", () => {
            package.style.transition = "transform 250ms ease";

            setTimeout(() => {
                package.style.transition = "none";
            }, 250);
        });

        package.addEventListener("mousemove", e => {
            if(!is_open) {
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
            }
        });

        package.addEventListener("mouseleave", () => {
            package.style.transition = "transform 250ms ease";
            package.style.transform = "";
        });

        package.addEventListener("click", () => {
            package.classList.toggle("open");
            is_open = package.classList.contains("open");
            if(is_open) {
                package.style.transition = "transform 250ms ease";
                package.style.transform = `
                    perspective(750px)
                    rotateX(0deg)
                    rotateY(0deg)
                `;

                const package_clone = package.cloneNode(true);
                relative_container.innerHTML = "";
                relative_container.appendChild(package_clone);
                activate(fullscreen_container);

                package_clone.onclick = () => {
                    const is_open = package_clone.classList.contains("open");

                    package_clone.classList.remove("open", "close");

                    // Force the browser to register the animation reset
                    void package_clone.offsetWidth;

                    package_clone.classList.add(is_open ? "close" : "open");
                };
            }
        })
    });
}

promise__initial_page_rendering.then(() => main());