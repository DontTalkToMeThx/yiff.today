const USER_AGENT = "yiff.today Mass Unfavorite/1.0"

async function getFavorites() {
  try {
    let res = await fetch("https://e621.net/favorites.json", {
      headers: {
        "User-Agent": USER_AGENT,
        Authorization: `Basic ${btoa(`${login.e621Username}:${login.e621ApiKey}`)}`
      }
    })

    if (res.ok) {
      return (await res.json()).posts.map(p => {
        p.tags = Object.values(p.tags).flat()
        return p
      })
    } else {
      console.error(`Fetching favorites failed (${res.status})`)
      console.error(await res.text())

      return null
    }
  } catch (e) {
    console.error(`Fetching favorites failed`)
    console.error(e)
    return null
  }
}

async function unfavorite(postId) {
  try {
    let body = new URLSearchParams()
    body.append("_method", "DELETE")
    let res = await fetch(`https://e621.net/favorites/${postId}.json`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Authorization: `Basic ${btoa(`${login.e621Username}:${login.e621ApiKey}`)}`
      },
      body
    })

    if (!res.ok) {
      console.error(`Failed to unfavorite ${postId} (https://e621.net/posts/${postId}) (${res.status})`)
      console.error(await res.text())
    } else {
      console.log(`Unfavorited ${postId} (https://e621.net/posts/${postId})`)
    }
  } catch (e) {
    console.error(`Failed to unfavorite ${postId} (https://e621.net/posts/${postId})`)
    console.error(e)
  }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function getPostsToUnfavorite(filter) {
  let favorites = await getFavorites()

  if (!favorites) {
    alert("Error fetching favorites")
    return
  }

  let groups = getGroups(filter)

  if (!groups) {
    console.error("Error parsing filter.")
    return
  }

  let builtQuery = groups === true ? null : buildQueryFromGroup(groups)

  if (!login.e621Username || !login.e621ApiKey) {
    alert("Username or API Key not present")
    return
  }

  let changes = { unfavorited: [], noChange: [] }
  let toUnfavorite = []

  for (let favorite of favorites) {
    if (builtQuery && !passesGroup(favorite.tags, builtQuery)) {
      changes.noChange.push({ id: favorite.id, tags: favorite.tags, operation: "NO CHANGE" })
      continue
    }

    toUnfavorite.push(favorite)

    changes.unfavorited.push({ id: favorite.id, tags: favorite.tags, operation: "UNFAVORITE" })
  }

  return { changes, toUnfavorite }
}

async function run() {
  if (!confirm("Are you sure?")) return

  let { changes, toUnfavorite } = await getPostsToUnfavorite(uiElements.filterText.value.trim())

  alert(`This will take ${toUnfavorite.length * 0.8} seconds. Do not close this window until complete.`)

  for (let favorite of toUnfavorite) {
    await unfavorite(favorite.id)
    await wait(800)
  }

  alert(`Complete. Information available in console. Total unfavorited: ${changes.unfavorited.length}.`)

  console.log(`Total unfavorited: ${changes.unfavorited.length}`)
  console.log(`Total unchanged: ${changes.noChange.length}`)

  console.log(changes)
}

const TOKENS_TO_SKIP = ["~", "-"]
const MODIFIERS = {
  NONE: 0,
  OR: 1
}

function passesGroup(tags, curGroup) {
  let { must, mustNot, should } = curGroup

  for (let token of must) {
    if (typeof (token) == "string") {
      if (!tags.includes(token)) return false
    } else {
      if (!passesGroup(tags, token)) return false
    }
  }

  let shouldPassed = should.length == 0

  for (let token of should) {
    if (typeof (token) == "string") {
      if (tags.includes(token)) {
        shouldPassed = true
        break
      }
    } else {
      if (passesGroup(tags, token)) {
        shouldPassed = true
        break
      }
    }
  }

  if (!shouldPassed) return false

  for (let token of mustNot) {
    if (typeof (token) == "string") {
      if (tags.includes(token)) return false
    } else {
      if (passesGroup(tags, token)) return false
    }
  }

  return true
}

function buildQueryFromGroup(group, curQuery = { must: [], should: [], mustNot: [] }) {
  let modifier = MODIFIERS.NONE

  for (let i = 0; i < group.tokens.length; i++) {
    let token = group.tokens[i]
    if (TOKENS_TO_SKIP.includes(token) || token == "") continue

    let previousToken = i > 0 ? group.tokens[i - 1] : null
    let previousNegate = previousToken == "-"
    let nextToken = i < group.tokens.length - 1 ? group.tokens[i + 1] : null

    if (nextToken == "~") modifier = MODIFIERS.OR

    if (!token.startsWith("__")) {
      if (modifier == MODIFIERS.NONE) {
        if (!previousNegate) {
          curQuery.must.push(token)
        } else {
          curQuery.mustNot.push(token)
        }
      } else if (modifier == MODIFIERS.OR) {
        if (!previousNegate) {
          curQuery.should.push(token)
        } else {
          curQuery.should.push({
            mustNot: token
          })
        }
      }
    } else {
      if (token.startsWith("__")) {
        let nextGroup = group.groups[parseInt(token.slice(2))]

        let query = { must: [], should: [], mustNot: [] }

        buildQueryFromGroup(nextGroup, query)

        if (modifier == MODIFIERS.NONE) {
          if (!previousNegate) curQuery.must.push(query)
          else curQuery.mustNot.push(query)
        } else if (modifier == MODIFIERS.OR) {
          if (!previousNegate) curQuery.should.push(query)
          else {
            curQuery.should.push({
              mustNot: query
            })
          }
        }
      }
    }

    if (modifier == MODIFIERS.OR && nextToken != "~") modifier = MODIFIERS.NONE
  }

  return curQuery
}

function getGroups(tags) {
  if (tags.length == 0) return true
  let tokenizer = new Tokenizer(tags)
  let currentGroupIndex = []
  let group = { tokens: [], groups: [] }

  for (let token of tokenizer) {
    let curGroup = group
    for (let group of currentGroupIndex) {
      curGroup = curGroup.groups[group]
    }

    if (token == "(") {
      currentGroupIndex.push(curGroup.groups.length)
      curGroup.groups.push({ tokens: [], groups: [] })
      curGroup.tokens.push(`__${curGroup.groups.length - 1}`)
    } else if (token == ")") {
      currentGroupIndex.splice(currentGroupIndex.length - 1, 1)
    } else {
      curGroup.tokens.push(token.toLowerCase())
    }
  }

  if (currentGroupIndex.length != 0) {
    return false
  }

  return group
}

class Tokenizer {
  constructor(raw) {
    this.raw = raw
    this.split = raw.trim().replace(/\s+/g, " ").replace("\n", " ").split("")
    this.done = false
    this.index = 0
  }

  *[Symbol.iterator]() {
    while (!this.done) {
      yield this.consume()
    }
  }

  peek() {
    let token = ""
    for (let i = this.index; i < this.split.length; i++) {
      let t = this.split[i]
      if (t == " ") {
        return token
      } else {
        token += t
      }
    }
  }

  consume() {
    let token = ""
    for (let i = this.index; i < this.split.length; i++) {
      let t = this.split[i]
      if (t == " ") {
        this.index = i + 1
        this.done = this.index >= this.split.length
        return token
      } else if ((t == "-") && token.length == 0) {
        this.index = i + 1
        this.done = this.index >= this.split.length
        return t
      } else {
        token += t
      }
    }

    this.index = this.split.length
    this.done = true

    return token
  }
}

uiElements.unfavoriteButton.addEventListener("click", run)

uiElements.showButton.addEventListener("click", async (e) => {
  let { toUnfavorite } = await getPostsToUnfavorite(uiElements.filterText.value.trim())

  slideshowController.slides = toUnfavorite.map(fav => new Slide(fav.id, fav.rating, fav.file.url, fav.preview.url, `https://e621.net/posts/${fav.id}`, fav.file.width, fav.file.height, new Date(fav.created_at), fav.score.total, getMediaTypeFromFileType(fav.file.ext), fav.file.md5, Object.values(fav.tags).flat(), fav.tags))

  slideshowController.setCurrentSlideNumber(0)
})