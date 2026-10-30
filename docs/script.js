const κ = "AIzaSyAM07AIfBXXRU0Y8MbpzySSVtCAG3xjHr0";
const spreadsheet_id = '1pSWHmoRA7jzdl81XBYCijammbIVrjFhTFQ6Q3Ema29s'; 
const PAGE = "Home";
const DEV_MODE = window.location.href.includes("127.0.0.1");
const OFFLINE_MODE = DEV_MODE;
const CACHE = true;
const CACHE_REFRESH = 6 // in hours
let main_promise;

const is_mobile = (navigator.maxTouchPoints > 0 || 'ontouchstart' in document.documentElement);

const svg_defs = `
<svg style="position:absolute; width:0; height:0; overflow:hidden"
  aria-hidden="true"
  focusable="false"">
    <defs>

        <!-- Very subtle blur to remove harsh transitions -->
        <filter
            id="blur"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
        >
            <feGaussianBlur stdDeviation="0.05"/>
        </filter>

        <!-- Customisable falloff curve -->
        <radialGradient id="soft_gradient">

            <stop offset="0%" stop-color="white" />
            <stop offset="60%" stop-color="white" />
            <stop offset="80%" stop-color="#bbb" />
            <stop offset="100%" stop-color="black" />

        </radialGradient>

        <!-- Mask that uses both gradient + blur -->
        <mask
            id="soft_mask"
            maskUnits="objectBoundingBox"
            maskContentUnits="objectBoundingBox"
        >
            <rect
                x="0"
                y="0"
                width="1"
                height="1"
                fill="black"
            />

            <circle
                cx="0.5"
                cy="0"
                r="1"
                fill="url(#soft_gradient)"
                filter="url(#blur)"
            />

        </mask>

    </defs>
</svg>
`

const header = $("header")[0];
const dom_main = $("main")[0];
const prevent_scroll_containers = $("[data-prevent-default-scroll-navigation]");
const document_width = document.documentElement.clientWidth;

document.body.insertAdjacentHTML("afterbegin", svg_defs);

function cache_data(name, data) {
    data["date_cached"] = Date.now();
    localStorage.setItem(name, JSON.stringify(data))
}

function _blank(a) {
    a.rel = "noopener noreferrer"
    a.target = "_blank"
}

async function re_cache_data(named_range, cached) {
    console.log("Recaching Data");

    const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}` +
        `?ranges=${encodeURIComponent(named_range)}` +
        `&includeGridData=true` +
        `&key=${κ}`
    );

    data = await res.json();
    cache_data(cached, data);

    return data;
}

async function fetch_data(named_range, ignore_blank_cells = true, force_refresh = false) {
    const cached = `cached_${named_range}`;
    let data;

    if(force_refresh) {
        data = await re_cache_data(named_range, cached);
    } else {
        try {
        data = JSON.parse(localStorage.getItem(cached));

        if (!data?.date_cached) {
            throw new Error("re_cache");
        }

        const timeout = CACHE_REFRESH * (60 * 60 * 1000);

        if ((Date.now() - data.date_cached > timeout && !OFFLINE_MODE) || !CACHE) {
            throw new Error("re_cache");
        }

        } catch (err) {
            data = await re_cache_data(named_range, cached);
        }
    }

    const rows = data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    let output = [];

    rows.forEach(row => {

        const values = row.values || [];
        let row_has_content = false;
        let row_cells = [];

        for (let i = 0; i < values.length; i++) {

            const text = values[i]?.formattedValue;

            if (!text || text.trim() === "") {

                if (!ignore_blank_cells) {
                    row_cells.push({});
                }

                continue;
            }

            row_has_content = true;

            row_cells.push({
                text: text,
                heading: values[i]?.userEnteredFormat?.textFormat?.bold === true
            });
        }

        if (!row_has_content) {
            output.push({ type: "row_break" });
        } else {
            output.push({
                type: "row",
                cells: row_cells
            });
        }
    });

    return output;
}

function parse_table(json, include_incomplete_rows = false) {
    const rows = json
        .filter(item => item.type === "row")
        .map(item => item.cells.map(cell => cell.text));
        
    const trunc = include_incomplete_rows ? 
    rows.filter(arr => arr[0] !== "FALSE")
    :
    rows.filter(
        arr => arr.length > 0 && !arr.some(el => el === "") && !arr.includes('FALSE')
    );

    const parsed = [];

    trunc.forEach((arr, i) => {
        const obj = {};

        arr.forEach((el, j) => {
            let formatted_el = el;

            const key = trunc[0][j];

            const bool_map = {
                "TRUE": true,
                "FALSE": false
            };

            if (el in bool_map) {
                formatted_el = bool_map[el];
            }

            if (key === "Date" && el !== key) {
                formatted_el = parse_gb_date(el);
            }

            if (key.includes("comma-separated")) {
                formatted_el = el.split(",");
            }

            obj[key] = formatted_el;
        });

        if (i > 0) {
            parsed.push(obj);
        }
    });

    return parsed;
}

function local_storage_reset() {
    console.log("Reloading Cache!")
    localStorage.clear();
    window.location.reload();
}

function parse_document(flat_data, pages, merge_content = true, custom_br = "<br>") {
    let sections = [];
    let current = null;

    let new_paragraph = true;

    flat_data.forEach(item => {
        if (item.type === "row_break") {
            new_paragraph = true;
            return;
        }

        if (item.type !== "row") return;

        item.cells.forEach(cell => {
            const text = cell.text;

            if (cell.heading) {
                current = {
                    heading: text,
                    content: [],
                    tag: text.toLowerCase().split(" ").join("_")
                };

                sections.push(current);

                new_paragraph = true;
                return;
            }

            if (!current) return;

            if (!merge_content) {
                current.content.push(text);
                new_paragraph = false;
                return;
            }

            const last_index = current.content.length - 1;

            if (new_paragraph || current.content.length === 0) {
                current.content.push(text);
            } else {
                current.content[last_index] += custom_br + text;
            }

            new_paragraph = false;
        });
    });

    if (pages) {
        sections = sections.filter(obj => !pages.includes(obj.heading));
    }

    return sections;
}

function parse_events(events, files) {
    let parsed = [];

    events.forEach(event => {
        let parsed_event = event;
        const date = (new Date(event["Date"])).toLocaleDateString("en-GB");
        const event_files = files.filter(file => file.folder.includes(date));
        if(event_files) parsed_event["files"] = event_files;
        parsed.push(parsed_event)
    });

    parsed.sort((a, b) => b["Date"] - a["Date"])

    return parsed;
}

async function fetch_sheet_names() {
    const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}` +
        `?fields=sheets(properties(title))` +
        `&key=${κ}`
    );

    const data = await res.json();
    const sheets = data.sheets.map(sheet => sheet.properties.title);
    localStorage.setItem("sheet_names", JSON.stringify({
        pages: sheets,
        timestamp: Date.now()
    }));

    return sheets;
}

async function fetch_events() {
    const events_res = await fetch_data("events");
    const files_res = await fetch_data("files");

    return parse_events(
        parse_table(events_res, include_incomplete_rows = true), 
        parse_table(files_res)
    );
}  

function activate(els, delay) {
    setTimeout(() => {
        if(typeof els === Array) {
            els.forEach(el => el.classList.add("active"))
        } else {
            try {els.classList.add("active")}
            catch (err) {throw err}
        }
    }, delay);
}

function deactivate(els, delay, timeout = 1000) {
    setTimeout(() => {
        if(typeof els === Array) {
            els.forEach(el => {
                el.classList.remove("active");
                el.classList.add("deactivating"); setTimeout(() => {
                    el.classList.remove("deactivating")
                }, timeout);
            })
        } else {
            try {
                els.classList.remove("active");
                els.classList.add("deactivating"); setTimeout(() => {
                    els.classList.remove("deactivating")
                }, timeout);
            }
            catch (err) {throw err}
        }
    }, delay);
}

function parse_gb_date(str) {
    const split = str.split("/");
    const mm = split[1].length > 1 ? split[1] : `0${split[1]}`;
    const dd = split[0].length > 1 ? split[0] : `0${split[0]}`;
    const yyyy = split[2].length > 2 ? split[2] : `20${split[2]}`;
    return Date.parse([mm, dd, yyyy].join("/"));
}

function shift_dom_el(el, index) {
    const parent = el.parentElement;
    if (!parent) return;

    const children = [...parent.children];
    const current_index = children.indexOf(el);
    const new_index = current_index + index;

    if (new_index < 0 || new_index >= children.length) return;

    parent.insertBefore(
        el,
        children[new_index + (index > 0 ? 1 : 0)] || null
    );
}

async function get_website_variable(var_name, attempt = 0) {
    if(attempt < 3) {
        website_variables = JSON.parse(localStorage.getItem("website_variables"));
        let val;
        try {
            val = website_variables.find(el => el["Variable Name"] === var_name)["Value"]
        } catch (err) {
            console.warn("New Website Variable detected")
        }

        if(!val && attempt < 3) {
            await set_website_variables(force_refresh = true);
            val = await get_website_variable(var_name, attempt = attempt + 1);
        }

        if (!Number.isNaN(parseFloat(val))) val = parseFloat(val);
        return val;
    } else {
        console.error("Please reset LocalStorage")
        return undefined;
    }
}

function update_styles(band_member_els, styles_intensity = 0.5, axis = "x", container = document_width, rotation_intensity = 0.5) {
    const is_horizontal = axis === "x";
    const container_size = typeof container === "number"
        ? container
        : container.getBoundingClientRect()[is_horizontal ? "width" : "height"];

    band_member_els.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const offset = (
            rect[is_horizontal ? "left" : "top"] +
            rect[is_horizontal ? "width" : "height"] / 2 -
            container_size / 2
        );

        const distance = Math.min(
            Math.abs(offset) * styles_intensity / (container_size / 2),
            1
        );

        const interpolated_val = (1 + Math.cos(distance * Math.PI)) / 2;

        // el.style.opacity = Math.min(1, interpolated_val + 0.25);
        el.style.transform = `perspective(500px) rotate${is_horizontal ? "Y" : "X"}(${is_horizontal ? "" : "-"}${scale_val(interpolated_val, 10 / rotation_intensity, 0) * Math.sign(offset)}deg) scale(${scale_val(interpolated_val, 0.4 / styles_intensity, 1)})`;
    });

    requestAnimationFrame(() => update_styles(band_member_els, styles_intensity, axis, document_width, rotation_intensity));
}

function initialise_read_mores(els) {
    els.forEach(el => {
        deactivate(el);
        el.style.overflowY = "auto";
        if(el.offsetHeight < el.scrollHeight) {
            el.classList.add("read-more")
            el.style.overflowY = "hidden"
        }
        activate(el)
    })
}

function stagger_activate_els(els, timeout) {
    Array.from(els).forEach((el, i) => activate(el, timeout * i))
}

async function populate_dyn_containers(data) {
    const containers = $(".dyn-container");
    containers.forEach(container => {
        const target_obj = data.find(entry => entry.tag === container.dataset.dynTag);
        if(container.dataset.dynAuto === "true") {
            container.innerHTML = "";

            if(container.dataset.dynHeading) {
                const heading = $el(container.dataset.dynHeading);
                container.appendChild(heading);
                heading.innerHTML = target_obj.heading;
            }

            target_obj.content.forEach(entry => {
                const dom_type = container.dataset.dynContent;
                const content_el = $el(dom_type);
                content_el.innerHTML = entry;

                if(dom_type === "a") {
                    let href = entry;
                    let icon_url = "";
                    if(entry.includes("https")) {
                        if(entry.includes("facebook")) icon_url = "facebook";
                        if(entry.includes("instagram")) icon_url = "instagram";
                        content_el.innerHTML = entry.split("https://")[1]?.split("www.")[1];
                    } 
                    else if(entry.includes("@")) {
                        icon_url = "email"
                        href = `mailto:${entry}`
                    }
                    else {
                        if(entry.includes("+44")) icon_url = "phone"
                        href = "#";
                        content_el.onclick = (e) => e.preventDefault();
                    } 
                    content_el.href = href;
                    content_el.style.setProperty("--icon-url", `url(../assets/${icon_url}.png)`);
                    _blank(content_el)
                }

                container.appendChild(content_el)
            })
        } else {
            try {
                const heading = container.querySelector(".dyn-heading");
                heading.innerHTML = target_obj.heading;
            } catch (err) {
                console.warn("Dynamic Content Generation: No Heading Found!")
            }
            
            try {
                const content = container.querySelector(".dyn-content");
                if(content.children.length === 0) {
                    content.innerHTML = target_obj.content
                } else {
                    target_obj.content.forEach((entry, i) => content.children[i].innerHTML = entry);
                }
            } catch (err) {
                console.warn("Dynamic Content Generation: No Content DOM Element(s) Found!")
            }
            
        }    

        if(!container.classList.contains("bg-glow")) fade_in(container)
    })

    console.log("Dynamic Content Generated Sucessfully!")
}

function generate_nav(pages) {
    const f_pages = pages.filter(page => !page.includes("dataonly"));

    let nav_struct = `            
    <h3><a href="/${DEV_MODE ? "index.html": ""}">lairdsbarndance.band</a></h3>
    <div class="spacer"></div>
    <nav>
        <ul></ul>
    </nav>
    `

    header.innerHTML = nav_struct;

    const ul = header.querySelector("ul");
    f_pages.forEach(page => {
        const anchor = $el("a");
        let url = `/pages/${page.toLowerCase().split(" ").join("_")}`;
        if(page === "Home") url = DEV_MODE ? "/index.html" : "/";
        anchor.href = url + (DEV_MODE && page !== "Home" ? ".html" : "");
        anchor.textContent = page;
        ul.appendChild(anchor);
    })

    const is_mobile = $("header > .spacer")[0].offsetWidth < 32;
    const menu_btn = $el("button.menu-btn");
    const close_btn = $el("button.close-btn");
    const nav = $("nav")[0];
    menu_btn.onclick = () => nav.classList.toggle("open");
    close_btn.onclick = () => nav.classList.remove("open");
    menu_btn.textContent = "menu" ;
    close_btn.textContent = "close";

    if(is_mobile) {
        header.classList.add("mobile-view"); 
        nav.classList.add("mobile-view"); nav.classList.add("leather");
        nav.appendChild(close_btn)
        header.appendChild(menu_btn);

        close_btn.style.setProperty("--menu-btn-height", menu_btn.offsetHeight + "px");
        close_btn.style.setProperty("--top", menu_btn.offsetTop + "px");
        close_btn.style.setProperty("--left", menu_btn.offsetLeft + "px");
    }
}

async function generate_leather(els) {
    await Promise.all(Array.from(els).map(async el => {
        const is_rough_border = el.classList.contains("rough-border");
        const mask_content = el.dataset.leatherMaskContent === "true";

        el.style.setProperty("--color", el.dataset.leatherColor || "var(--blue)");

        const content = el.innerHTML;

        if (mask_content) {
            const images = Array.from(el.querySelectorAll("img"));

            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();

                return new Promise(resolve => {
                    img.addEventListener("load", resolve, { once: true });
                    img.addEventListener("error", resolve, { once: true });
                });
            }));

            el.innerHTML = "";

            const wrapper = $el(".content");
            wrapper.innerHTML = content;
            el.appendChild(wrapper);
        }

        const bg_struct = `
            <div class="leather-background">
                <div class="sheen"></div>
                <div class="glow-layer" id="sheen-mask"></div>
                <div class="dimples"></div>
                <div class="displacement" style="--random-position: ${Math.floor(Math.random() * 100)}% ${Math.floor(Math.random() * 100)}%"></div>
            </div>
        `;

        el.insertAdjacentHTML("afterbegin", bg_struct);

        if (!is_rough_border) {
            const borders = $el(".leather-borders");
            const div_arr = ["top", "right", "bottom", "left"];

            div_arr.forEach(div => {
                borders.innerHTML += `
                    <div class="${div}">
                        <div class="normal"></div>
                        <div class="overlay"></div>
                    </div>
                `;
            });

            el.appendChild(borders);
        }
    }));
}

async function fade_in(el, timeout = 1000, visible_timeout = 1000) {
    el.classList.add("visible");

    setTimeout(() => {
        el.classList.remove("visible")
    }, visible_timeout);

    return new Promise(resolve => {
        setTimeout(() => {
            el.classList.remove("pre-render");
            resolve();
        }, timeout);
    });
}

async function load_font_buffer(url) {
    const response = await fetch(url);
    return await response.arrayBuffer();
}

async function create_tight_svg_title(text, small_cap_ratio = 0.7) {
    const buffer = await load_font_buffer("/assets/GoudyHan.ttf");
    const font = opentype.parse(buffer);

    const svg_ns = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(svg_ns, "svg");
    const defs = document.createElementNS(svg_ns, "defs");
    const group = document.createElementNS(svg_ns, "g");
    const all_caps = text === "FAQs";

    const gradient_id = `title_gradient_${Math.random().toString(36).slice(2)}`;

    defs.innerHTML = `
        <linearGradient id="${gradient_id}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0.0142528" stop-color="#F39544"/>
            <stop offset="0.0416382" stop-color="#DD6045"/>
            <stop offset="0.0702075" stop-color="#AD423D"/>
            <stop offset="0.365385" stop-color="#BE322E"/>
            <stop offset="1" stop-color="#A64243"/>
        </linearGradient>
    `;

    if(!all_caps) text = text.toUpperCase();

    let x = 0;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const scale = i === 0 && !all_caps ? 1 : small_cap_ratio;
        const size = 120 * scale;

        const glyph = font.getPath(char, x, 0, size);

        const path_el = document.createElementNS(svg_ns, "path");
        path_el.setAttribute("d", glyph.toPathData(2));
        path_el.setAttribute("fill", `url(#${gradient_id})`);

        group.appendChild(path_el);

        x += font.getAdvanceWidth(char, size);
    }

    svg.appendChild(defs);
    svg.appendChild(group);

    // temporary DOM insertion ONLY for bbox calculation
    document.body.appendChild(svg);
    svg.getBoundingClientRect();

    const bbox = group.getBBox();

    svg.setAttribute(
        "viewBox",
        `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
    );

    svg.remove();

    return svg;
}

function apply_header_css_vars(banner) {
    document.body.style.setProperty("--banner-height", banner.offsetHeight + "px");    
    $(".border > .join")[0].style.setProperty("--cap-width", $(".border > .left")[0].offsetWidth + "px");
}

async function fetch_image(img_id, {max_width, max_height} = {}) {
    const img_url = !max_width && !max_height
        ? `https://lh3.googleusercontent.com/d/${img_id}`
        : `https://lh3.googleusercontent.com/d/${img_id}=${max_width ? `w${max_width}` : ""}${max_width && max_height ? "-" : ""}${max_height ? `h${max_height}` : ""}`;

    await new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = resolve;
        img.onerror = () => reject(new Error(`Failed to load image: ${img_url}`));
        // img.onerror = resolve;

        img.src = img_url;
    });

    return img_url;
}

async function generate_header(this_page, pages) {
    generate_nav(pages); // 1rem padding between title and nav

    const is_home = this_page === "Home";

    const banner = $(".banner")[0];
    banner.innerHTML = ""; // Remove SEO <h1/>
    
    document.body.style.setProperty("--header-height", header.offsetHeight + "px");
    if(this_page.length > 9) banner.classList.add("smaller")

    const logo = $el("img.logo");
    logo.src = "/assets/logo_small.svg";

    let title;

    if(is_home) {
        logo.src = "/assets/logo.svg";
        logo.classList.add("large")
    } else {
        title = await create_tight_svg_title(this_page, 0.8);
        title.classList.add("title");
    }

    const border = $el(".border");
    ["left", "join", "right"].forEach(child => {
        const el = $el("." + child);
        el.style.setProperty("--mask-url", `url("/assets/header/${child}.svg")`);
        border.appendChild(el);
    });

    const children = is_home ? [logo, border] : [logo, title, border];
    banner.appendChildren(...children);

    if(is_home) {
        logo.onload = () => apply_header_css_vars(banner)
    } else {
        apply_header_css_vars(banner);
    }
    
    if(header.classList.contains("mobile-view")) $("nav")[0].style.transition = "500ms ease transform, 500ms ease filter";
    
    console.log("Header Generated Sucessfully!")
}

async function generate_carousel_items({files, 
    carousel_item_class_name = "carousel-item",
    random_rotation_strength = 2,
}) {
    return await Promise.all(files.map(async file => {
        const carousel_item = $el(`.${carousel_item_class_name}`);
        carousel_item.style.transform = `rotate(${Math.random() * random_rotation_strength - (random_rotation_strength / 2)}deg)`;

        const is_video = file.mime_type?.startsWith("video/");
        const media = is_video ? $el("iframe") : $el("img");

        if (file.width && file.height) {
            carousel_item.style.aspectRatio = `${file.width} / ${file.height}`;
        }

        if (is_video) {
            media.src = `https://drive.google.com/file/d/${file.file_id}/preview`;
            media.allow = "autoplay";
            media.allowFullscreen = true;
            media.loading = "lazy";
            carousel_item.appendChild(media);
        } else {
            try {
                media.src = await fetch_image(file.file_id);
                media.alt = "";
                media.loading = "lazy";
                media.decoding = "async";
                carousel_item.appendChild(media);
            } catch(err) {
                console.warn("Carousel Item not appended: id=" + file.file_id)
            }
        }

        return carousel_item;
    }));
}

async function generate_carousel_items({
    files,
    carousel_item_class_name = "carousel-item",
    random_rotation_strength = 2,
}) {
    return (await Promise.all(files.map(async file => {
        const is_video = file.mime_type?.startsWith("video/");
        const media = $el(is_video ? "iframe" : "img");

        media.className = carousel_item_class_name;

        const rotation = Math.random() * random_rotation_strength
            - (random_rotation_strength / 2);

        media.style.setProperty("--random-rotation", `${rotation}deg`);

        if (file.width && file.height) {
            media.style.aspectRatio = `${file.width} / ${file.height}`;
        }

        media.ariaLabel = file["description"] ?? "";

        if (is_video) {
            media.src = `https://drive.google.com/file/d/${file.file_id}/preview`;
            media.allow = "autoplay";
            media.allowFullscreen = true;
            media.loading = "lazy";
        } else {
            try {
                media.src = await fetch_image(file.file_id);
                media.alt = "";
                media.loading = "lazy";
                media.decoding = "async";
            } catch (err) {
                console.warn("Carousel Item not appended: id=" + file.file_id);
                return null;
            }
        }

        return media;
    }))).filter(Boolean);
}

async function get_package_types() {
    const packages_res = await fetch_data("packages");
    const packages_obj = parse_document(packages_res, null, true, custom_br = `<div class="break"></div>`);
    const package_types = packages_obj.filter(el => el.heading !== "General Information").map(el => el.heading);
    return package_types;
}

function append_loader(container) {
    const loading = $el("img.loading");
    loading.src = "/assets/loading.svg";
    document.body.appendChild(loading);
    activate(loading)

    const interval_id = setInterval(() => {
        if(!loading.classList.contains("active")) clearInterval(interval_id);
        const {left, top, width, height} = container.getBoundingClientRect();
        loading.style.top = height > 0 ? (top + (height / 2)) : (document.documentElement.clientHeight / 2) + "px";
        loading.style.left = width > 0 ? ((left + (width / 2))) : (document.documentElement.clientWidth / 2) + "px";
    }, 100);

    return loading;
}

function build_svg_mask(
    els,
    glow_blur = 60,
    subtract_blur = 20,
    blur_multiplier = 1,
    custom_mask_els = null
) {
    const svg_ns = "http://www.w3.org/2000/svg";

    const doc_width = document.documentElement.offsetWidth * 1.05;
    const doc_height = document.documentElement.scrollHeight;

    function create_svg_element(tag, attributes = {}) {
        const el = document.createElementNS(svg_ns, tag);

        Object.entries(attributes).forEach(([k, v]) => {
            el.setAttribute(k, v);
        });

        return el;
    }

    function create_blur_filter(id, std_dev) {
        const filter = create_svg_element("filter", {
            id,
            x: "-50%",
            y: "-50%",
            width: "200%",
            height: "200%"
        });

        filter.appendChild(
            create_svg_element("feGaussianBlur", {
                stdDeviation: std_dev
            })
        );

        return filter;
    }

    function get_rect(el) {
        const r = el.getBoundingClientRect();

        return {
            x: r.left + window.scrollX,
            y: r.top + window.scrollY,
            width: r.width,
            height: r.height
        };
    }

    function create_glow_rect(el) {
        const { x, y, width, height } = get_rect(el);

        const radius = Math.min(width, height) / 2;

        return create_svg_element("rect", {
            x,
            y,
            width,
            height,
            rx: radius,
            ry: radius,
            fill: "white"
        });
    }

    function create_subtract_rect(el) {
        const bleed = 1.1;
        let { x, y, width, height } = get_rect(el);
        x -= (width * (bleed - 1)) / 2;
        y -= (height * (bleed - 1)) / 2;

        width *= bleed;
        height *= bleed;

        // IMPORTANT: no rounding → true rectangle
        return create_svg_element("rect", {
            x,
            y,
            width,
            height,
            fill: "black"
        });
    }

    const svg = create_svg_element("svg", {
        width: doc_width,
        height: doc_height,
        viewBox: `0 0 ${doc_width} ${doc_height}`
    });

    svg.classList.add("defs-container")
    
    Object.assign(svg.style, {
        position: "absolute",
        top: "0",
        left: "0",
        pointerEvents: "none",
        overflow: "visible"
    });

    const defs = create_svg_element("defs");

    const id = Date.now();

    const glow_filter_id = `glow_${id}`;
    const subtract_filter_id = `subtract_${id}`;

    const glow_filter = create_blur_filter(glow_filter_id, glow_blur);
    const glow_subtract_filter = create_blur_filter(subtract_filter_id, subtract_blur * blur_multiplier);

    defs.appendChild(glow_filter);
    defs.appendChild(glow_subtract_filter);

    const mask = create_svg_element("mask", {
        id: `mask_${id}`,
        maskUnits: "userSpaceOnUse",
        maskContentUnits: "userSpaceOnUse",
        x: 0,
        y: 0,
        width: doc_width,
        height: doc_height
    });

    // full black base
    mask.appendChild(
        create_svg_element("rect", {
            x: 0,
            y: 0,
            width: doc_width,
            height: doc_height,
            fill: "black"
        })
    );

    const glow_group = create_svg_element("g", {
        filter: `url(#${glow_filter_id})`
    });

    const subtract_group = create_svg_element("g", {
        filter: `url(#${subtract_filter_id})`
    });

   els.forEach(el => {
       glow_group.appendChild(create_glow_rect(el));
       
       const parent = el.parentElement;

        if (parent && !el.classList.contains("no-mask")) {
            console.log("creating subtract rect")
            if (custom_mask_els == null) {
                const subtract_rect = create_subtract_rect(
                    parent.querySelector(".bg-glow")
                );

                subtract_group.appendChild(subtract_rect);
            }
        }
        });

        if (custom_mask_els != null && !el.classList.contains("no-mask")) {
            console.log("creating subtract rect")
            custom_mask_els.forEach(el => {
                subtract_group.appendChild(create_subtract_rect(el));
            });
    }

    mask.appendChild(glow_group);
    mask.appendChild(subtract_group);

    defs.appendChild(mask);
    svg.appendChild(defs);

    document.body.appendChild(svg);

    return mask.id;
}

function generate_polaroid(link, info_text, index = 0, rotation_strength = 1.5) {
    const polaroid = $el(".polaroid,pre-render,paper-overlay,toggle-fullscreen");
    polaroid.style.setProperty("--random-rotation", (Math.random() * rotation_strength * (index % 2 === 0 ? 1 : -1)) + "deg")
    const img = $el("img");
    img.src = link; img.alt = info_text;
    const span = $el("span.info");
    span.textContent = info_text;
    polaroid.appendChildren(img, span);
    return polaroid;
}

function generate_post_it(heading, content, index, rotation_strength = 1.5, colour_arr = ["#FFFFFF", "#FFF8EF", "#EEF6FF"], post_it_obj = null, page_link = null) {
    const container = $el(".post-it,pre-render");

    container.style.setProperty("--random-rotation", `${Math.random() * rotation_strength - (rotation_strength/2)}deg`);
    container.style.setProperty("--random-bg-offset", `${Math.random() * 100}% ${Math.random() * 100}%`);
    container.style.setProperty("--random-colour", colour_arr[index % colour_arr.length]);

    let page_link_required = false;
    try {
        page_link_required = post_it_obj["Page Link (Required with Button Text)"] != undefined;
    } catch (err) {
        console.warn("Post-it generated without page link")
    }

    let content_struct = `<p>${content}</p>`;

    if(content.constructor == Array) {
        if(content.length > 1) {
            content_struct = "";
            content.forEach(par => content_struct += `<p>${par}</p>`);
        }
    }

    container.innerHTML = `
        <div class="heading">
            <img src="/assets/bronze-pin.png">
            <h3>${heading}</h3>
        </div>
        <div class="info">${content_struct}</div>
        ${page_link_required ? 
            `<a href="${page_link}">${post_it_obj["Button Text (Optional)"]}</a>`
            : 
            ""
        }
    `;
    
    return container;
}

function generate_post_its(post_its_container, obj, colour_arr = ["#FFFFFF", "#FFF8EF", "#EEF6FF"], rotation_strength = 1.5) {
    obj.forEach((post_it, index) => {
        let target_page;
        let page_link = post_it["Page Link (Required with Button Text)"];
        if(page_link) {
            target_page = (page_link === "Home") 
            ? 
            (DEV_MODE ? "/index.html" : "/") 
            : 
            `/pages/${page_link.toLowerCase().split(" ").join("_")}` + (
                DEV_MODE && page_link !== "Home" 
                ? 
                ".html" 
                : ""
            )
        }

        post_its_container.appendChild(
            generate_post_it(
                post_it["Title"], 
                post_it["Text"], 
                index,
                rotation_strength,
                colour_arr,
                post_it,
                target_page
            )
        );
    })

    post_its_container.style.setProperty("--column-width", post_its_container.querySelector(".post-it").offsetWidth + "px");
}

async function generate_background(parallax = 0.3, glows = $(".bg-glow"), custom_mask_els = null) {
    const background_container = $el(".bg-container,pre-render");
    const instrument_container = $el(".instrument-container,scroll-transfer");
    let rand = Math.random();

    for(let i = 0; i < 2; i++) {
        const dom_el = $el(`.instrument,${["left", "right"][i]}`);
        const body_height = document.body.offsetHeight;
        dom_el.style.setProperty("--offset-top", `${rand * body_height}px`);
        dom_el.style.height = ((1 / parallax) * 100 + 25) + "%";
        instrument_container.appendChild(dom_el);
    }

    background_container.appendChild(instrument_container);

    if(!$(".bg-container")[0]) {
        $(".scroll-wrapper")[0].insertBefore(background_container, $("main")[0]);
        window.onscroll = () => {
            instrument_container.scrollTop = document.documentElement.scrollTop * parallax;
        };
    } else {
        window.onscroll = () => {
            $(".instrument-container")[0].scrollTop = document.documentElement.scrollTop * parallax;
        };
    }

    glows.forEach(glow => glow.id = Date.now());

    generate_glows(glows);

    await new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const blur_multiplier = await get_website_variable("Instrument Background Falloff");
                const mask_id = build_svg_mask($(".glow"), 60, 20, blur_multiplier || 1, custom_mask_els);
                background_container.style.mask = `url(#${mask_id})`;

                const glow_els = $(".glow");

                fade_in(background_container);
                glows.forEach(glow_container => fade_in(glow_container));
                glow_els.forEach(el => fade_in(el));

                const images = Array.from(background_container.querySelectorAll("img"));

                await Promise.all(images.map(img => {
                    if(img.complete) {
                        return img.naturalWidth > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error(`Image failed to load: ${img.src}`));
                    }

                    return new Promise((resolve_image, reject_image) => {
                        img.addEventListener("load", resolve_image, { once: true });
                        img.addEventListener("error", () => {
                            reject_image(new Error(`Image failed to load: ${img.src}`));
                        }, { once: true });
                    });
                }));

                resolve();
            } catch(error) {
                reject(error);
            }
        }, 50);
    });

    prevent_scroll_containers.forEach(scroll_container => {
        Array.from(scroll_container.querySelectorAll("a"))
            .filter(anchor => anchor.href.includes("#"))
            .forEach(anchor => {
                anchor.addEventListener("click", e => {
                    e.preventDefault();
                    scroll_to_el(document.getElementById(anchor.href.split("#").pop()));
                });
            });
    });
}

function scroll_to_el(el, scroll_margin = 40) {
    const target_scroll =
        window.scrollY +
        el.getBoundingClientRect().top -
        header.offsetHeight -
        scroll_margin;

    window.scrollTo(0, target_scroll);
}

function scroll_to_carousel_el(carousel, el) {
    carousel.scrollTo({
        left: carousel.scrollLeft + el.getBoundingClientRect().x - carousel.getBoundingClientRect().x
    });
}

function generate_paper_overlays() {
    const els = $(".paper-overlay");
    els.forEach(el => {
        el.style.setProperty("--random-paper-position", `${Math.random() * 100}% ${Math.random() * 100}%`);
    })
}

function initialise_scroll_draggable() {
    $(".scroll-draggable").forEach(el => {
        let is_dragging = false;
        let has_moved = false;
        let start_x = 0;
        let scroll_left = 0;

        let click_target = null;
        let release_target = null;

        const drag_threshold = 5;

        el.addEventListener("pointerdown", e => {
            if (e.button !== 0) return;

            is_dragging = true;
            has_moved = false;

            click_target = e.target.closest(".toggle-fullscreen");
            release_target = null;

            start_x = e.clientX;
            scroll_left = el.scrollLeft;

            el.style.scrollSnapType = "none";
            el.style.cursor = "grabbing";

            el.setPointerCapture(e.pointerId);
        });

        el.addEventListener("pointermove", e => {
            if (!is_dragging) return;

            const movement = e.clientX - start_x;

            if (Math.abs(movement) > drag_threshold) {
                has_moved = true;
            }

            if (has_moved) {
                el.scrollLeft = scroll_left - movement;
            }
        });

        function stop_dragging() {
            if (!is_dragging) return;

            is_dragging = false;
            el.style.cursor = "grab";

            if (!has_moved) return;

            const container_style = getComputedStyle(el);

            const padding_left = parseFloat(container_style.scrollPaddingLeft) || 0;
            const padding_right = parseFloat(container_style.scrollPaddingRight) || 0;

            const snapport_width = el.clientWidth - padding_left - padding_right;

            const scrollport_left = el.getBoundingClientRect().left + el.clientLeft;

            const max_scroll = el.scrollWidth - el.clientWidth;

            let nearest_target = null;
            let nearest_distance = Infinity;

            el.querySelectorAll("*").forEach(target => {
                const target_style = getComputedStyle(target);

                const align_values = target_style.scrollSnapAlign.trim().split(/\s+/);
                const align = align_values[align_values.length - 1];

                if (align === "none") return;

                const rect = target.getBoundingClientRect();

                const margin_left = parseFloat(target_style.scrollMarginLeft) || 0;
                const margin_right = parseFloat(target_style.scrollMarginRight) || 0;

                const target_left = el.scrollLeft +
                    rect.left - scrollport_left - margin_left;

                const target_right = el.scrollLeft +
                    rect.right - scrollport_left + margin_right;

                let target_scroll_left;

                switch (align) {
                    case "start":
                        target_scroll_left = target_left - padding_left;
                        break;

                    case "center":
                        target_scroll_left = (target_left + target_right) / 2 -
                            (padding_left + snapport_width / 2);
                        break;

                    case "end":
                        target_scroll_left = target_right -
                            (el.clientWidth - padding_right);
                        break;

                    default:
                        return;
                }

                target_scroll_left = Math.max(0, Math.min(max_scroll, target_scroll_left));

                const distance = Math.abs(target_scroll_left - el.scrollLeft);

                if (distance < nearest_distance) {
                    nearest_distance = distance;
                    nearest_target = target_scroll_left;
                }
            });

            if (nearest_target !== null) {
                el.scrollTo({
                    left: nearest_target,
                    behavior: "smooth"
                });
            }
        }

        el.addEventListener("pointerup", e => {
            release_target = document.elementFromPoint(
                e.clientX,
                e.clientY
            )?.closest(".toggle-fullscreen") ?? null;

            stop_dragging();
        });

        el.addEventListener("click", e => {
            if (has_moved) {
                e.preventDefault();
                e.stopImmediatePropagation();

                click_target = null;
                release_target = null;
                has_moved = false;

                return;
            }

            if (
                !click_target ||
                click_target !== release_target ||
                !el.contains(click_target)
            ) {
                click_target = null;
                release_target = null;
                return;
            }

            if (typeof click_target.onclick === "function") {
                click_target.onclick.call(click_target, e);
            }

            click_target = null;
            release_target = null;
        }, true);

        el.addEventListener("pointercancel", () => {
            stop_dragging();

            click_target = null;
            release_target = null;
        });

        el.addEventListener("lostpointercapture", () => {
            stop_dragging();
        });
    });
}

function debug_scroll_draggable(el = document.querySelector(".scroll-draggable"), {
    move_log_interval = 120
} = {}) {
    console.log("Hello")
    if (!el) {
        console.warn("[scroll-draggable] No matching element found.");
        return () => {};
    }

    const nodes = [];

    for (let node = el; node; node = node.parentNode) {
        nodes.push(node);
        if (node === document) break;
    }

    if (!nodes.includes(window)) nodes.push(window);

    const handlers = [];
    const last_move_logs = new Map();

    function node_label(node) {
        if (node === window) return "window";
        if (node === document) return "document";

        if (node.nodeType === 11) return "shadow-root";

        if (!node.tagName) return node.nodeName;

        const id = node.id ? `#${node.id}` : "";
        const classes = Array.from(node.classList || [])
            .map(class_name => `.${class_name}`)
            .join("");

        return `${node.tagName.toLowerCase()}${id}${classes}`;
    }

    const event_types = [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
        "gotpointercapture",
        "lostpointercapture",
        "scroll"
    ];

    nodes.forEach(node => {
        ["capture", "bubble"].forEach(phase => {
            const capture = phase === "capture";

            event_types.forEach(type => {
                const handler = e => {
                    // Throttle pointermove logging to avoid flooding the console
                    if (type === "pointermove") {
                        const key = `${node_label(node)}-${phase}`;
                        const now = performance.now();

                        if (now - (last_move_logs.get(key) || 0) < move_log_interval) {
                            return;
                        }

                        last_move_logs.set(key, now);
                    }

                    console.log(
                        `[scroll-draggable] ${type} | ${phase} | ${node_label(node)}`,
                        {
                            target: node_label(e.target),
                            current_target: node_label(e.currentTarget),
                            event_phase: e.eventPhase,
                            default_prevented: e.defaultPrevented,
                            propagation_stopped: e.cancelBubble,

                            pointer_id: e.pointerId,
                            pointer_type: e.pointerType,
                            button: e.button,
                            buttons: e.buttons,

                            client_x: e.clientX,
                            client_y: e.clientY,

                            has_pointer_capture: Number.isInteger(e.pointerId)
                                ? el.hasPointerCapture(e.pointerId)
                                : undefined,

                            scroll_left: el.scrollLeft,
                            scroll_top: el.scrollTop
                        }
                    );
                };

                node.addEventListener(type, handler, {
                    capture,
                    passive: true
                });

                handlers.push({ node, type, handler, capture });
            });
        });
    });

    console.log("[scroll-draggable] Debugging enabled:", el);
    console.log("[scroll-draggable] Event propagation path:", nodes.map(node_label));

    // Return a function to remove all diagnostic listeners
    return function stop_debugging() {
        handlers.forEach(({ node, type, handler, capture }) => {
            node.removeEventListener(type, handler, capture);
        });

        console.log("[scroll-draggable] Debugging stopped.");
    };
}

// Later, when finished:
// stop_debugging();

function fullscreen_img_container_logic() {
    $(".fullscreen-img-container").forEach(old => old.remove());
    const fullscreen_img_container = $el(".fullscreen-img-container");
    const close_btn = $el("button.close");
    const close_img = $el("img"); close_img.src = "/assets/header/close.svg";
    close_btn.appendChild(close_img);
    fullscreen_img_container.appendChild(close_btn);
    document.body.appendChild(fullscreen_img_container);

    const els = $(".toggle-fullscreen");
    els.forEach(el => {
        el.onclick = () => {
            fullscreen_img_container.querySelectorAll("*:not(.close, .close > *)").forEach(el => el.remove());
            const img_clone = el.cloneNode(true);
            img_clone.style.setProperty("--random-rotation", "0deg");
            img_clone.classList.remove("toggle-fullscreen");

            if(img_clone.ariaLabel) {
                const polaroid = generate_polaroid(el.src, el.ariaLabel);
                polaroid.style.setProperty("--aspect-ratio", el.offsetWidth / el.offsetHeight);
                fullscreen_img_container.appendChild(polaroid);
                fade_in(polaroid)
            } else { 
                fullscreen_img_container.appendChild(img_clone);
                fade_in(img_clone)
            }
            activate(fullscreen_img_container)
        }
    })

    fullscreen_img_container.onclick = (e) => {
        if([fullscreen_img_container, close_btn, close_img].includes(e.target)) {
            deactivate(fullscreen_img_container);
        }
    }
}

function generate_glows(glows) {
    const viewport_width = document.documentElement.offsetWidth;

    const rules = {
        left:   { left: 0,   tx: viewport_width > 1200 ? -100 : -50 },
        right:  { right: 0,  tx: viewport_width > 1200 ? 100 : 50 },
        top:    { top: 0,    ty: -25 },
        bottom: { bottom: 0, ty:  7.5 }
    };
    
    glows.forEach(glow_container => {
        void glow_container.offsetWidth; void glow_container.offsetHeight;
        const container_size = {width: glow_container.offsetWidth, height: glow_container.offsetHeight}
        const glow_el = $el(".glow");
        glow_el.id = glow_container.id;
        const glow_wrapper = $el(".bg-glow-wrapper")
        Object.entries(container_size).forEach(([property, value]) => glow_wrapper.style.setProperty(`--content-${property}`, value + "px"));
        const positions = glow_container.dataset.glowPos.split(" ");

        let tx = 0;
        let ty = 0;
        let scale = "100%";

        if (positions.length === 1 && positions[0] === "center") {

            glow_el.style.left = "50%";
            glow_el.style.top = "50%";
            glow_el.style.width = "112.5%";
            glow_el.style.height = "100%";
            glow_el.style.aspectRatio = "unset";

            tx = ty = -50;

        } else {

            positions.forEach(position => {

                if (position === "center") {

                    if (positions.some(p => p === "top" || p === "bottom")) {
                        glow_el.style.left = "50%";
                        tx = -50;
                    } else {
                        glow_el.style.top = "50%";
                        ty = -50;
                    }

                    return;
                }

                const rule = rules[position];

                Object.assign(glow_el.style, {
                    left: rule.left,
                    right: rule.right,
                    top: rule.top,
                    bottom: rule.bottom
                });

                tx = rule.tx ?? tx;
                ty = rule.ty ?? ty;
            });
        }

        glow_el.style.transform =
            `translate(${tx}%, ${ty}%) scale(${
                glow_container.dataset.glowSize || scale
            })`;

        glow_container.parentNode.insertBefore(
            glow_wrapper,
            glow_container
        );

        let content_mask;
        try {content_mask = glow_container.dataset.glowMaskContent} catch (err) {}
        if(content_mask === "false") glow_el.classList.add("no-mask")

        glow_wrapper.appendChild(glow_el);
        glow_wrapper.appendChild(glow_container);
    });
}

function generate_quotes(json) {
    const quotes_sub_containers = $(".quotes:not(.mobile-quotes) > div");
    const quotes = parse_table(json).slice(0, 4);
    quotes.forEach((quote, index) => {
        const quote_el = $el(".quote");
        const heading = $el("h3");
        const info_span = $el("span");
        heading.textContent = quote["Review"];
        info_span.textContent = quote["Source"];
        quote_el.appendChildren(heading, info_span);
        quotes_sub_containers[Math.floor(index / 2)].appendChild(quote_el);
        $(".mobile-quotes > div")[0].appendChild(quote_el.cloneNode(true));
    })
}

async function set_website_variables(force_refresh = false) {
    const res = await fetch_data("Website Variables (dataonly)", true, force_refresh);
    const variables = parse_table(res);
    localStorage.setItem("website_variables", JSON.stringify(variables));
}

async function initial_page_rendering() {
    set_website_variables();
    const this_page = document.title.split("- ").pop();

    let pages = JSON.parse(localStorage.getItem("sheet_names"));
    if(pages == undefined || pages.timestamp == undefined || Date.now() - pages.timestamp > CACHE_REFRESH * 60 * 60 * 1000) {
        pages_res = await fetch_sheet_names();
        pages = {pages: pages_res, timestamp: Date.now()}
    }
    
    // const res = await fetch_data(PAGE);
    // const data = parse_document(res, pages.pages);

    await generate_header(this_page, pages.pages);
    await generate_leather($(".leather"));
    const banner = $(".banner")[0];
    await fade_in(header, 1000);
    activate(banner);
    await new Promise(resolve => setTimeout(resolve, 125));
}

const promise__initial_page_rendering = initial_page_rendering();