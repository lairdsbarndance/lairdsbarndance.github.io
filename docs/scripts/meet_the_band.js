function generate_member(obj, biography_length) {
    const member_container = $el("article.band-member");
    const name = $el("h3.name");
    name.textContent = `${obj["Name"]} - ${obj["Member Type"] !== "Musician" ? obj["Member Type"].toLowerCase() : obj["Instrument"].toLowerCase()}`;
    const img = $el("img");
    try {
        img.src = fetch_image(obj["Image URL (Autofilled)"].split("id=").pop())
    } catch(err) {
        console.warn("Reverting to Local Image Backup");
        img.src = `/assets/meet_the_band_backup/${obj["Name"]}.png`;
    }
    const par = $el("p");
    par.textContent = biography_length !== "long" ? obj["Shortened Biography"] : obj["Biography"];

    member_container.appendChildren(name, img, par);
    return {member_container, par};
}

async function main() {
    const members_res = await fetch_data("band_members");
    const members_obj = parse_table(members_res);
    const biography_length = get_website_variable("Biography Length");
    const band_container = $(".band")[0];
    const interactive_container = $el(".interactive-container");
    band_container.appendChild(interactive_container);
    const band_sub_container = $el(".wrapper");
    interactive_container.appendChild(band_sub_container);

    members_obj.forEach(obj => {
        const {member_container, par} = generate_member(obj, biography_length);
        band_sub_container.appendChild(member_container);

        requestAnimationFrame(() => {
            if(biography_length === "long") {
                par.style.overflowY = "auto";
                if(par.scrollHeight > par.offsetHeight) {
                    par.classList.add("read-more");
                    par.style.setProperty("--max-lines", parseInt(getComputedStyle(par).getPropertyValue("--max-lines")) + 1);
                }
                par.style.overflowY = "hidden";
            }

            par.onclick = () => {
                par.classList.toggle("expanded");
                if(biography_length === "switch") {
                    if(par.classList.contains("expanded")) {
                        par.textContent = obj["Biography"]
                    } else {
                        par.textContent = obj["Shortened Biography"]
                    }
                }
            }
        })
    })

    interactive_container.appendChild(band_sub_container.cloneNode(true));
    
    const scroll_container = interactive_container.cloneNode(true);
    scroll_container.className = "scroll-container"
    band_container.appendChild(scroll_container);
    
    void scroll_container.offsetWidth;
    const scroll_container_width = scroll_container.offsetWidth;
    activate(scroll_container);

    let scroll_timeout;
    let is_interacting = false;
    interactive_container.addEventListener("scroll", (e) => {
        if(!is_interacting) {
            is_interacting = true;
            console.log("Interaction started");
            const x_pos = scroll_container.getBoundingClientRect().left;
            const scroll_left = Math.abs(x_pos / scroll_container_width) * interactive_container.scrollWidth;
            deactivate(scroll_container);
            activate(interactive_container);
            interactive_container.style.scrollBehavior = "instant";
            interactive_container.scrollTo(scroll_left, 0);
            interactive_container.style.scrollBehavior = "";
        }

        clearTimeout(scroll_timeout);

        scroll_timeout = setTimeout(() => {
            is_interacting = false;
            console.log("Interaction ended");
            deactivate(interactive_container);
            activate(scroll_container);
            if(interactive_container.scrollLeft > band_sub_container.offsetWidth) {
                interactive_container.style.scrollBehavior = "auto";
                interactive_container.scrollTo({
                    left: interactive_container.scrollLeft - band_sub_container.offsetWidth,
                    behavior: "auto"
                });
                interactive_container.style.scrollBehavior = "";
            }
        }, 250);
    });
}

promise__initial_page_rendering.then(() => main())