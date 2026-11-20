# Loads the app's R files the way Shiny does when the app starts: every file in R/, in order.
app_dir <- normalizePath(file.path(testthat::test_path(), "..", ".."))
for (f in sort(list.files(file.path(app_dir, "R"), pattern = "\\.R$", full.names = TRUE))) {
  source(f, local = FALSE)
}
