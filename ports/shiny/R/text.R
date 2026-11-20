# Every piece of text the Shiny app shows or says, in one place. The words match apps/web/src/text.ts.
# "keys" is the text for a computer and "touch" the text for a phone or tablet.

plural <- function(n, one, many) paste(n, if (n == 1) one else many)

TEXT <- list(
  name = "Sankofa Snake",
  logo_label = "Sankofa bird, the game's logo",
  lead = "Steer a snake of woven kente blocks around the board and collect cowrie shells. Each level adds a new world and one new rule.",
  sankofa_note = "Sankofa is an Akan word from Ghana. It means \"go back and get it.\"",
  buttons = list(
    play = "Play", daily = "Daily challenge", choose_level = "Choose a level", how_to_play = "How to play",
    back = "Back", pause = "Pause", resume = "Resume", sound = "Sound", vibration = "Vibration",
    play_again = "Play again", practice_again = "Practice again", next_level = "Next level",
    play_daily = "Play today's challenge", reset = "Reset progress", confirm_reset = "Delete my progress",
    cancel = "Cancel"
  ),
  help = list(
    heading = "How to play",
    steer = list(
      keys = "Steer with the arrow keys or W, A, S and D. On a phone, swipe on the board or press the arrow buttons under it.",
      touch = "Steer with the arrow buttons under the board, or swipe on the board in the direction you want the snake to go."
    ),
    rules = c(
      "Eat 20 cowrie shells to clear a level and open the next one. The snake grows longer with each shell.",
      "The run ends if the snake runs into its own tail, an obstacle or a vehicle. Vehicles stop for the snake, so cross the road in front of them or behind them. From the City on, the edge of the board is a wall too.",
      "In the Ocean and the Weaving village, currents push the snake one square the way their arrows point when it swims across them. Swimming along a current, the way its arrows point, makes the snake faster until it leaves the current.",
      "In the Lab, the Maze and the Weaving village, power-ups appear on the board for a short time. The gold hourglass is slow motion, the red arrows shrink the snake, and the green loop lets the snake pass through its own tail once."
    ),
    pause = list(
      keys = "Pause with Space, P or Escape. The game also pauses when you switch tabs.",
      touch = "Tap the board to pause. The game also pauses when you switch to another app or tab."
    ),
    more = c(
      "Clearing a level earns one star. A high score and a fast finish earn up to two more.",
      "The daily challenge picks a world and its rules from the date, so everyone gets the same challenge on the same date. The date comes from your own device, so a new challenge starts at your midnight. Clear it on days in a row to build a streak.",
      "Free play is the classic game in any world you have opened, with wrap-around edges or walls. It goes on until the snake crashes.",
      "Practice opens every level at a slower speed. Running into something only stops the snake, so it suits a class demo."
    ),
    sound_key = "Press M to turn the sound off or on.",
    settings = "Settings",
    gold_means_on = "Gold means on.",
    vibration_note = "Vibration works on most Android phones.",
    progress = "Your progress",
    progress_note = "Scores, stars, cleared levels, the daily streak and free play bests stay on this device.",
    confirm = "This deletes your scores, stars, cleared levels, daily streak and free play bests on this device. Your sound and vibration switches stay as they are. It can't be undone.",
    reset_done = "Progress deleted."
  ),
  levels = list(
    heading = list(levels = "Levels", free = "Free play", practice = "Practice"),
    tabs_label = "Way to play",
    edges_label = "Edges",
    wrap = "Wrap-around edges",
    walls = "Walls",
    intro = list(
      levels = "Clear a level to open the next one.",
      free = "Play the classic game in any world you have opened, until the snake crashes.",
      practice = "Every level, at a slower speed. Running into something only stops the snake."
    ),
    card = function(n) paste("Level", n),
    locked = function(previous) paste0("Clear the ", previous, " to open this level"),
    practice_status = "Slower, and the run never ends",
    free_best = function(n) paste("Best", n, "cowries"),
    best = function(n) paste("Best", n),
    not_played = "Not played yet"
  ),
  daily = list(
    heading = "Daily challenge",
    lead = function(date) paste0(date, ". Everyone gets the same challenge on the same date. A new one starts at midnight on your device."),
    world = "Today's world",
    goal = function(challenge, goal) paste0(challenge, " Eat ", goal, " cowries to clear it."),
    cleared_today = "Cleared today",
    not_cleared = "Not cleared yet today",
    todays_best = function(n) paste("Today's best", n),
    streak_label = "Streak:",
    streak_rest = function(longest) paste0("Longest: ", plural(longest, "day", "days"), ".")
  ),
  hud = list(
    cowries = "Cowries", score = "Score", best = "Best", board = "Game board",
    eaten = function(eaten, goal = NULL) if (is.null(goal)) as.character(eaten) else paste(eaten, "of", goal),
    slow = function(moves) paste("Slow motion for", moves, "more moves"),
    passes = function(n) if (n == 1) "One pass through the tail" else paste(n, "passes through the tail"),
    hint = list(
      keys = "Arrow keys or W, A, S and D to steer. Space to pause and M for sound.",
      touch = "Press the arrows or swipe on the board to steer. Tap the board to pause."
    )
  ),
  run = list(
    level = function(n, name) paste0("Level ", n, ": ", name),
    daily = function(name) paste0("Daily challenge: ", name),
    free = function(name) paste0("Free play: ", name),
    practice = function(name) paste0("Practice: ", name),
    start = list(keys = "Press an arrow key to start.", touch = "Press an arrow or swipe to start."),
    bump_title = "Bump",
    bump_go = "Choose a new direction to keep going.",
    paused = "Paused",
    over = "Game over",
    free_tally = function(eaten, best) paste0("You collected ", plural(eaten, "cowrie", "cowries"), ". Your best here is ", best, "."),
    tally = function(eaten, goal, score) paste0("You collected ", eaten, " of ", goal, " cowries. Score ", score, "."),
    practice_done = "Practice run complete",
    practice_tally = function(goal, score) paste0("You collected all ", goal, " cowries. Score ", score, "."),
    cleared = "Level cleared",
    daily_cleared = "Daily challenge cleared",
    stars = function(n) paste(n, "of 3 stars"),
    bonus = function(score, bonus) paste0("Score ", score, ", including a time bonus of ", bonus, "."),
    daily_streak = function(n) paste0("Your streak is ", plural(n, "day", "days"), ". Come back tomorrow for a new challenge."),
    best_stars = function(n) paste0("Your best on this level is ", n, " stars."),
    all_cleared = "You've cleared all nine levels."
  ),
  obstacle = list(market = "a market stall", city = "a building", lab = "a lab bench", maze = "a wall of the maze", ocean = "a canoe", village = "a loom"),
  say = list(
    paused = "Paused.",
    playing = "Playing.",
    setting = function(name, on) paste0(if (name == "sound") "Sound" else "Vibration", if (on) " on." else " off."),
    ate = function(eaten, score, goal = NULL) paste0(if (is.null(goal)) paste("Cowrie", eaten) else paste("Cowrie", eaten, "of", goal), ". Score ", score, "."),
    speedup = "The snake is faster now.",
    power_appeared = function(name) paste0("A ", name, " power-up appeared."),
    passed = "The snake passed through its tail."
  ),
  power = list(
    name = list(slow = "slow motion", shrink = "shrink", pass = "pass"),
    text = list(
      slow = "Slow motion. The snake moves slower for a while.",
      shrink = "Shrink. The snake is shorter now.",
      pass = "Pass. The snake can go through its own tail once."
    )
  ),
  pad = list(label = "Steering", up = "Up", down = "Down", left = "Left", right = "Right"),
  cant_save = "This browser isn't letting the game save. Your progress lasts only until you close the page."
)

hit_name <- function(s, cause) {
  if (identical(cause, "wall")) return("the wall")
  if (identical(cause, "obstacle")) return(if (is.null(TEXT$obstacle[[s$level$world]])) "an obstacle" else TEXT$obstacle[[s$level$world]])
  if (identical(cause, "vehicle")) return(paste("a", if (is.null(s$crash_vehicle)) "car" else s$crash_vehicle))
  "its own tail"
}

crash_text <- function(s) {
  what <- hit_name(s, s$crash)
  if (isTRUE(s$crash_pushed)) return(paste0("A current pushed the snake into ", what, "."))
  if (identical(s$crash, "wall")) "The snake hit the wall." else paste0("The snake ran into ", what, ".")
}

bump_text <- function(s) paste0("The snake bumped into ", hit_name(s, s$bump), ".")

star_text <- function(n) paste0(strrep("★", n), strrep("☆", 3 - n))
