const getBody = () => document.querySelector(
  "body"
)

function emptyBody(){
  const b = getBody()
  while(
    b.firstElementChild
  ){
    b.removeChild(
      b.lastElementChild
    )
  }
}

function makeRootWithId(
  id
){
  const b = getBody()
  const d = document.createElement(
    "div"
  )
  d.id = id
  b.append(
    d
  )
  return d
}

export {
  getBody,
  emptyBody,
  makeRootWithId
}