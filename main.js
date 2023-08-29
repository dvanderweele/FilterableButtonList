import "./style.css"
import {
  createMachine,
  actions,
  spawn,
  sendParent,
  raise,
  interpret
} from "xstate"
import Fuse from "fuse.js"
import {
  makeRootWithId
} from "./utils.js"

const {
  log,
  assign
} = actions

/*
   * Add sort A-Z, Z-A buttons, plus related ability of list to rebuild mulyiple times in lifespan of ChatList
   * Add fuzzy filter box element which on input starts a timer (w/ configurable timeout param maybe starting at 500ms). It always restarts on new input. if allowed to timeout, it then initiates a list resort and subsequent rebuild.
 */

const ListItem = createMachine({
  predictableActionArguments: true,
  initial: "idle",
  context: {},
  states: {
    idle: {
      on: {
        init: {
          target: "run",
          actions: assign(
            (
              ctx,
              evt
            ) => ({
              ...ctx,
              key: evt.key,
              parentEl: evt.parentEl
            })
          )
        }
      }
    },
    run: {
      invoke: {
        src: ctx => clb => {
          const li = document.createElement(
            "li"
          )
          const button = document.createElement(
            "button"
          )
          button.innerText = ctx.key
          li.append(
            button
          )
          const handler = () => {
            clb(
              "select"
            )
          }
          button.addEventListener(
            "click",
            handler
          )
          ctx.parentEl.append(
            li
          )
          return () => {
            button.removeEventListener(
              "click",
              handler
            )
          }
        }
      },
      on: {
        select: {
          actions: sendParent(ctx => ({
            type: "selection",
            key: ctx.key
          }))
        }
      }
    }
  }
})

const ButtonList = createMachine({
  predictableActionArguments: true,
  initial: "setup",
  context: {},
  states: {
    setup: {
      invoke: {
        src: ctx => new Promise(
          res => {
            const rootEl = makeRootWithId(
              ctx.rootElName
            )
            const filterPanel = document.createElement(
              "div"
            )
            filterPanel.id = "filterpanel"
            const exitButton = document.createElement(
              "button"
            )
            exitButton.innerText = "Exit"
            exitButton.id = "exitbutton"
            const fuzzySearchInput = document.createElement(
              "input"
            )
            fuzzySearchInput.id = "fuzzysearch"
            fuzzySearchInput.setAttribute(
              "type",
              "text"
            )
            fuzzySearchInput.setAttribute(
              "placeholder",
              "filter..."
            )
            const sortButton = document.createElement(
              "button"
            )
            sortButton.id = "sortbutton"
            sortButton.innerText = "A-Z"
            filterPanel.append(
              exitButton,
              fuzzySearchInput,
              sortButton
            )
            const ul = document.createElement(
              "ul"
            )
            ul.id = "unorderedlist"
            rootEl.append(
              filterPanel,
              ul
            )
            const result = {
              rootEl,
              filterPanel,
              exitButton,
              fuzzySearchInput,
              sortButton,
              ul
            }
            res(result)
          }
        ),
        onDone: {
          target: "operate",
          actions: assign(
            (
              ctx,
              evt
            ) => ({
              ...ctx,
              rootEl: evt.data.rootEl,
              filterPanel: evt.data.filterPanel,
              exitButton: evt.data.exitButton,
              fuzzySearchInput: evt.data.fuzzySearchInput,
              sortButton: evt.data.sortButton,
              ul: evt.data.ul
            })
          )
        },
        onError: {
          actions: log(
            (_, evt) => evt.toString()
          )
        }
      }
    },
    operate: {
      type: "parallel",
      states: {
        watchExitButton: {
          invoke: {
            src: ctx => clb => {
              const {
                exitButton
              } = ctx
              const handler = () => {
                clb(
                  "quit"
                )
              }
              exitButton.addEventListener(
                "click",
                handler
              )
              return () => {
                exitButton.removeEventListener(
                  "input",
                  handler
                )
              }
            }
          },
          on: {
            quit: "#theend"
          }
        },
        watchTextInput: {
          invoke: {
            src: ctx => clb => {
              const handler = () => {
                clb(
                  "inputChange"
                )
              }
              ctx.fuzzySearchInput.addEventListener(
                "input",
                handler
              )
              return () => {
                ctx.fuzzySearchInput.removeEventListener(
                  "input",
                  handler
                )
              }
            }
          }
        },
        sinceLastInput: {
          initial: "idle",
          states: {
            idle: {
              on: {
                inputChange: "watch"
              }
            },
            watch: {
              after: [
                {
                  delay: "configuredDelay",
                  target: "idle",
                  actions: raise(
                    "reorder"
                  )
                }
              ],
              on: {
                inputChange: "bounce"
              }
            },
            bounce: {
              always: [
                {
                  target: "watch"
                }
              ]
            }
          }
        },
        watchSortButton: {
          invoke: {
            src: ctx => clb => {
              const {
                sortButton
              } = ctx
              const handler = () => {
                if(
                  sortButton.innerText === "A-Z"
                ){
                  sortButton.innerText = "Z-A"
                } else {
                  sortButton.innerText = "A-Z"
                }
                clb(
                  "reorder"
                )
              }
              sortButton.addEventListener(
                "click",
                handler
              )
              return () => {
                sortButton.removeEventListener(
                  "input",
                  handler
                )
              }
            }
          }
        },
        listManager: {
          initial: "sorting",
          states: {
            sorting: {
              invoke: {
                src: ctx => new Promise(
                  res => {
                    const {
                      sortButton,
                      fuzzySearchInput,
                      ul
                    } = ctx
                    const unsorted = fuzzySearchInput.value === "" ? (
                      ctx.names.map(
                        name => ({
                          item: {
                            name
                          }
                        })
                      )
                    ) : (
                      new Fuse(
                        ctx.names.map(
                          name => ({
                            name
                          })
                        ),
                        {
                          keys: [
                            "name"
                          ]
                        }
                      ).search(
                        fuzzySearchInput.value
                      )
                    )
                    const sorted = unsorted.sort(
                      sortButton.innerText === "A-Z" ? ((
                        a,
                        b
                      ) => {
                        a = a.item.name
                        b = b.item.name
                        if(
                          a < b
                        ){
                          return -1
                        } else if(
                          b < a
                        ){
                          return 1
                        } else {
                          return 0
                        }
                      }) : ((
                        a,
                        b
                      ) => {
                        a = a.item.name
                        b = b.item.name
                        if(
                          a < b
                        ){
                          return 1
                        } else if(
                          b < a
                        ){
                          return -1
                        } else {
                          return 0
                        }
                      })
                    ).map(
                      obj => obj.item.name
                    )
                    if(
                      typeof ctx.listItems !== "undefined"
                    ){
                      ctx.listItems.forEach(
                        li => li.stop()
                      )
                    }
                    while(
                      ul.firstElementChild
                    ){
                      ul.lastElementChild.remove()
                    }
                    const listItems = sorted.map(
                      () => spawn(
                        ListItem
                      )
                    )
                    sorted.forEach(
                      (
                        val,
                        idx
                      ) => {
                        listItems[
                          idx
                        ].send({
                          type: "init",
                          key: val,
                          parentEl: ul
                        })
                      }
                    )
                    res(
                      listItems
                    )
                  }
                ),
                onDone: {
                  target: "runningListUI",
                  actions: [
                    assign(
                      (
                        ctx,
                        evt
                      ) => ({
                        ...ctx,
                        listItems: evt.data
                      })
                    )
                  ]
                },
                onError: {
                  actions: log(
                    (_, evt) => evt.toString()
                  )
                },
              }
            },
            runningListUI: {
              on: {
                reorder: {
                  target: "sorting"
                },
                selection: {
                  target: "#theend"
                }
              }
            }
          }
        }
      }
    },
    done: {
      id: "theend",
      type: "final",
      data: (
        _,
        evt
      ) => typeof evt.key === "undefined" ? ({}) : ({
        choice: evt.key
      })
    }
  }
}, {
  delays: {
    configuredDelay: ctx => typeof ctx.delay === "number" ? ctx.delay : 500
  }
})

interpret(
  createMachine(
    {
      predictableActionArguments: true,
      initial: "init",
      states: {
        init: {
          invoke: {
            src: ButtonList,
            data: {
              rootElName: "buttonList", 
              names: [
                "Lorem",
                "Ipsum",
                "Dolor",
                "Sit",
                "Amet",
                "Consectetur",
                "Adipiscing",
                "Elit",
                "Sed",
                "Do",
                "Eiusmod",
                "Tempor",
                "Incididunt",
                "Ut",
                "Enim",
                "Ad"
              ],
              delay: 270
            },
            onDone: {
              actions: log(
                (_, evt) => evt.data
              )
            },
            onError: {
              actions: log(
                "Error in ButtonList"
              )
            }
          }
        }
      }
    }
  )
).start()

export default ButtonList