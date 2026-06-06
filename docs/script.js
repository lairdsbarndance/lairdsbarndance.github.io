const κ = "AIzaSyAM07AIfBXXRU0Y8MbpzySSVtCAG3xjHr0";
const spreadsheet_id = '1pSWHmoRA7jzdl81XBYCijammbIVrjFhTFQ6Q3Ema29s'; 
const PAGE = "Home";

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
const dom_main = $("main")[0]

document.body.insertAdjacentHTML("afterbegin", svg_defs);

async function fetch_data(named_range) {
    const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet_id}` +
        `?ranges=${encodeURIComponent(named_range)}` +
        `&includeGridData=true` +
        `&key=${κ}`
    );

    const data = await res.json();
    const rows = data.sheets?.[0]?.data?.[0]?.rowData ?? [];

    let output = [];

    rows.forEach(row => {
        const values = row.values || [];

        let row_has_content = false;
        let row_cells = [];

        for (let i = 0; i < values.length; i++) {
            const text = values[i]?.formattedValue;

            if (!text || text.trim() === "") continue;

            row_has_content = true;

            row_cells.push({
                text: text,
                heading: values[i]?.userEnteredFormat?.textFormat?.bold === true
            });
        }

        if (!row_has_content) {
            output.push({ type: "row_break" });
        } else {
            output.push({ type: "row", cells: row_cells });
        }
    });

    return output;
}

function parse_table(json) {
    let trunc = json.filter(arr => (arr.filter(el => el === '').length === 0 && arr.length > 0))
    let parsed = [];
    trunc.forEach((arr, i) => {
        let obj = Object();
        arr.forEach((el, j) => {
            let formatted_el = el;
            const key = trunc[0][j];
            const bool_map = {"TRUE": true, "FALSE": false};
            if(Object.keys(bool_map).includes(el)) formatted_el = bool_map[el];
            if(key === "Date" && el !== key) {
                formatted_el = parse_gb_date(el);
            }
            if(key.includes("comma-separated")) formatted_el = el.split(",")
            obj[key] = formatted_el;
        })
        if(i > 0) parsed.push(obj)
    })
    return parsed;
}

function parse_document(flat_data, pages) {
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

            const last_index = current.content.length - 1;
            if (new_paragraph || current.content.length === 0) {current.content.push(text)}
            else {current.content[last_index] += "<br>" + text;}
            new_paragraph = false;
        });
    });

    sections = sections.filter(obj => !pages.includes(obj.heading));

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
    localStorage.setItem("sheet_names", JSON.stringify(sheets));

    return sheets;
}

async function fetch_events() {
    const events_res = await fetch_data("events"); const files_res = await fetch_data("files");
    const events = parse_table(events_res); const files = parse_table(files_res);
    const parsed_events = parse_events(events, files);
    return parsed_events;
}  

function parse_gb_date(str) {
    const split = str.split("/");
    const mm = split[1].length > 1 ? split[1] : `0${split[1]}`;
    const dd = split[0].length > 1 ? split[0] : `0${split[0]}`;
    const yyyy = split[2].length > 2 ? split[2] : `20${split[2]}`;
    return Date.parse([mm, dd, yyyy].join("/"));
}

function populate_dyn_containers(data) {
    const containers = $(".dyn-container");
    containers.forEach(container => {
        const target_obj = data.find(entry => entry.tag === container.getAttribute("data-dyn-tag"))
        const heading = $el(container.getAttribute("data-dyn-heading"));
        container.appendChild(heading);

        heading.innerHTML = target_obj.heading;
        target_obj.content.forEach(entry => {
            const dom_type = container.getAttribute("data-dyn-content");
            const content_el = $el(dom_type);
            content_el.innerHTML = entry;
            if(dom_type === "a") content_el.href = entry
            container.appendChild(content_el)
        })
        
    })
}

function generate_nav(pages) {
    const f_pages = pages.filter(page => !page.includes("readonly"));

    let nav_struct = `            
    <h3><a href="/index.html">lairdsbarndance.band</a></h3>
    <div class="spacer"></div>
    <nav>
        <ul></ul>
    </nav>
    `

    header.innerHTML = nav_struct;

    const ul = header.querySelector("ul");
    f_pages.forEach(page => {
        let url = `/pages/${page.toLowerCase().split(" ").join("_")}.html`;
        if(page === "Home") url = "/index.html"; // since all pages bar index are stored in subdir

        const anchor = $el("a");
        anchor.href = url;
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

function generate_leather(els) {
    els.forEach(el => {
        const is_rough_border = el.classList.contains("rough-border");
        const bg_struct = `
            <div class="leather-background">
                <div class="sheen"></div>
                <div class="glow" id="sheen-mask"></div>
                <div class="dimples"></div>
                <div class="displacement"></div>
            </div>
        `;
        el.insertAdjacentHTML("afterbegin", bg_struct);

        if(!is_rough_border) {
            const borders = $el(".leather-borders");
            const div_arr = ["top", "right", "bottom", "left"];
            div_arr.forEach(div => {borders.innerHTML += `
            <div class="${div}">
            <div class="normal"></div>
            <div class="overlay"></div>
            </div>`})
            el.appendChild(borders);
        }
    })
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

async function generate_header(this_page, pages) {
    generate_nav(pages); // 1rem padding between title and nav

    const is_home = this_page === "Home";

    const banner = $(".banner")[0];
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

    setTimeout(() => {
        document.body.style.setProperty("--banner-height", banner.offsetHeight + "px");    
        $(".border > .join")[0].style.setProperty("--cap-width", $(".border > .left")[0].offsetWidth + "px");
        banner.classList.add("active")
    }, 25);
        
    if(header.classList.contains("mobile-view")) $("nav")[0].style.transition = "500ms ease transform, 500ms ease filter";

    dom_main.style.setProperty("padding-block", `${header.offsetHeight + banner.offsetHeight + 40}px`);
}

function build_svg_mask(els) {
    const svg_ns = "http://www.w3.org/2000/svg";

    const doc_width = document.documentElement.scrollWidth;
    const doc_height = document.documentElement.scrollHeight;

    // Create SVG container
    const svg = document.createElementNS(svg_ns, "svg");
    svg.setAttribute("width", doc_width);
    svg.setAttribute("height", doc_height);
    svg.setAttribute("viewBox", `0 0 ${doc_width} ${doc_height}`);
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";

    // ---------- FILTER (blur) ----------
    const defs = document.createElementNS(svg_ns, "defs");

    const filter = document.createElementNS(svg_ns, "filter");
    const filter_id = `blur_${Date.now()}`;

    filter.setAttribute("id", filter_id);

    // IMPORTANT: large blur radius (SVG uses user units, not rem)
    const blur = document.createElementNS(svg_ns, "feGaussianBlur");
    blur.setAttribute("stdDeviation", "60"); 
    // ~ approximation of 7.5rem depending on root font size

    filter.appendChild(blur);
    defs.appendChild(filter);

    // ---------- MASK ----------
    const mask = document.createElementNS(svg_ns, "mask");
    const mask_id = `mask_${Date.now()}`;
    mask.setAttribute("id", mask_id);

    els.forEach(el => {
        const rect = el.getBoundingClientRect();
        const x = rect.left + window.scrollX;
        const y = rect.top + window.scrollY;

        const svg_rect = document.createElementNS(svg_ns, "rect");

        svg_rect.setAttribute("x", x);
        svg_rect.setAttribute("y", y);
        svg_rect.setAttribute("width", rect.width);
        svg_rect.setAttribute("height", rect.height);

        // Rounded corners (50%)
        const radius = Math.min(rect.width, rect.height) / 2;
        svg_rect.setAttribute("rx", radius);
        svg_rect.setAttribute("ry", radius);

        svg_rect.setAttribute("fill", "white");

        mask.appendChild(svg_rect);
    });

    // Apply blur to mask content via group wrapper
    const g = document.createElementNS(svg_ns, "g");
    g.setAttribute("filter", `url(#${filter_id})`);

    // Move mask children into filtered group
    while (mask.firstChild) {
        g.appendChild(mask.firstChild);
    }
    mask.appendChild(g);

    defs.appendChild(mask);
    svg.appendChild(defs);

    document.body.appendChild(svg);

    return mask_id;
}

function generate_background(glow_els, parallax = 0.3) {
    const background_container = $el(".bg-container");
    const instrument_container = $el(".instrument-container");
    let rand = Math.random();

    for(let i = 0; i < 2; i++) {
        const dom_el = $el(`.instrument,${["left", "right"][i]}`);
        const body_height = document.body.offsetHeight;
        console.log(body_height)
        dom_el.style.setProperty("--offset-top", `${rand * body_height}px`); // ensure right instrument has 50% extra offset; backgrounds appear different
        instrument_container.appendChild(dom_el)
    }

    background_container.appendChild(instrument_container);
    $(".scroll-wrapper")[0].insertBefore(background_container, $("main")[0]);

    window.onscroll = () => instrument_container.scrollTop = document.documentElement.scrollTop * parallax;

    const glows = $(".bg-glow");
    generate_glows(glows);
    const mask_id = build_svg_mask($(".glow"));
    background_container.style.mask = `url(#${mask_id})`;
}

function generate_glows(glows) {
    const rules = {
        left:   { left: 0,   tx: -50 },
        right:  { right: 0,  tx:  50 },
        top:    { top: 0,    ty: -50 },
        bottom: { bottom: 0, ty:  50 }
    };

    glows.forEach(glow_container => {
        const glow_el = $el(".glow");
        const positions = glow_container.dataset.glowPos.split(" ");

        let tx = 0;
        let ty = 0;

        if (positions.length === 1 && positions[0] === "center") {
            glow_el.style.left = "50%";
            glow_el.style.top = "50%";
            glow_el.style.width = "100%"; glow_el.style.height = "100%"; glow_el.style.aspectRatio = "unset";
            tx = ty = -50;
        }
        else {
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
                Object.assign(glow_el.style, rule);

                tx = rule.tx ?? tx;
                ty = rule.ty ?? ty;
            });
        }

        glow_el.style.transform = `translate(${tx}%, ${ty}%) scale(${glow_container.dataset.glowSize})`;
        glow_container.prepend(glow_el);
    });
}

async function main() { 
    const this_page = document.title.split("- ").pop();
    let pages = JSON.parse(localStorage.getItem("sheet_names"));
    if(!pages) pages = await fetch_sheet_names();
    // const res = await fetch_data(PAGE);
    // const res = await fetch_data("contact_prompt");
    // const data = parse_document(res, pages);
    // populate_dyn_containers(data);
    generate_header(this_page, pages);
    generate_leather($(".leather"));
    window.addEventListener("DOMContentLoaded", () => {
        generate_background();
    })
}

main();