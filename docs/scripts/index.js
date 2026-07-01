fetch_data("quotes_table")
.then(json => generate_quotes(json))

window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        $(".quotes")[0].style.setProperty("--quotes-width", `${(document.body.offsetWidth - $(".banner")[0].offsetWidth) * 0.5}px`)
    }, 1)
})
