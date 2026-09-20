promise__initial_page_rendering.then(() => {main()})

function get_image_link(url) {
    let f_link = url;

    if (f_link.includes("drive.google.com")) {
        const url = new URL(f_link);
        let id = url.searchParams.get("id");

        if (!id) {
            id = f_link.match(/\/d\/([^/]+)/)?.[1];
        }

        if (id) {
            f_link = `https://drive.google.com/thumbnail?id=${id}&sz=w2000`;
        }
    }

    return f_link;
}

function generate_polaroid(link, info_text, index, rotation_strength = 1.5) {
    const polaroid = $el(".polaroid,pre-render,paper-overlay,toggle-fullscreen");
    polaroid.style.setProperty("--random-rotation", (Math.random() * rotation_strength * (index % 2 === 0 ? 1 : -1)) + "deg")
    const img = $el("img");
    img.src = link; img.alt = info_text;
    const span = $el("span.info");
    span.textContent = info_text;
    polaroid.appendChildren(img, span);
    return polaroid;
}

async function main() {
    const history_res = await fetch_data("history", ignore_blank_cells = false);
    const history_obj = parse_table(history_res);
    const spacer_height_arr = [];

    const history_section = $("section.history")[0];
    history_section.innerHTML = "";
    history_obj.forEach((el, index) => {
        const article = $el("article.bg-glow");
        article.setAttribute("data-glow-pos", `top ${index % 2 === 0 ? "left" : "right"}`);
        article.setAttribute("data-glow-size", "125%");
        const polaroid = generate_polaroid(
            link = get_image_link(el["Image URL"]),
            info_text = el["Image Description"],
            index
        );
        const heading = $el("h2.pre-render");
        heading.textContent = el["Section Title"];
        const p = $el("p.pre-render");
        p.textContent = el["Text"];
        const spacer = $el(".spacer");

        if(el["Section Title"]) {
            article.appendChildren(polaroid, heading, p, spacer);
        } else {
            article.appendChildren(polaroid, p, spacer);
        }
        history_section.appendChild(article);
    })

    const images = [...history_section.querySelectorAll("img")];

    await Promise.all(
        images.map(img => {
            if (img.complete) return Promise.resolve();

            return new Promise(resolve => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
            });
        })
    );

    const history_sections = $("section.history article");

    history_sections.forEach((section, index) => {
            if (index > 0) {
                section.style.setProperty(
                    "--spacer-height",
                    spacer_height_arr[index - 1]
                );
            }
            const spacer = section.querySelector(".spacer");
            spacer_height_arr.push(spacer.offsetHeight + "px");
            const polaroid_img = section.querySelector(".polaroid > img");
            polaroid_img.style.setProperty("--aspect-ratio", polaroid_img.offsetWidth / polaroid_img.offsetHeight);
    });

    generate_background().then(() => {
        history_sections.forEach((section, index) => {
            setTimeout(() => {
                Array.from(section.querySelectorAll("*")).forEach(el => fade_in(el));
            }, 1000 * index);
        });

        generate_paper_overlays();
        fullscreen_img_container_logic();
    })
}