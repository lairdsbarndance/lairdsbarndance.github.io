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
    const band_sub_container = $el(".wrapper");
    band_container.appendChild(band_sub_container);

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

    band_container.appendChild(band_sub_container.cloneNode(true));
    let scroll_timeout;
    band_container.addEventListener("scroll", (e) => {
        clearTimeout(scroll_timeout);

        scroll_timeout = setTimeout(() => {
            if(band_container.scrollLeft > band_sub_container.offsetWidth) {
                band_container.style.scrollBehavior = "auto";
                band_container.scrollTo({
                    left: 0,
                    behavior: "auto"
                });
                band_container.style.scrollBehavior = "";
            }
        }, 250);
    });
}

promise__initial_page_rendering.then(() => main())