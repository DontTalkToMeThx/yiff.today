let implicationsCache = {}

let tagImplicationHandler = {
  async getTagImplications(tags, childrenOnly) {
    let tagImplications = {}

    tags = tags.trim().split(" ")

    if (!childrenOnly) {
      for (let i = tags.length - 1; i >= 0; i--) {
        let tag = tags[i]
        if (implicationsCache[tag]) {
          tagImplications[tag] = implicationsCache[tag]
          tags.splice(i, 1)
        }
      }
    }

    if (tags.length > 0) {
      let res = await fetch(`https://search.yiff.today/tagrelationships?tags=${tags.join("%20")}${childrenOnly ? "&include=children" : ""}`)

      if (res.ok) {
        for (let [tagName, implications] of Object.entries(await res.json())) {
          tagImplications[tagName] = implications
  
          implicationsCache[tagName] = implications
        }
      }
    }

    return tagImplications
  }
}