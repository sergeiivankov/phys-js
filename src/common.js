/**
 * Идентификаторы типов тел
 *
 * @type  {Object}
 */
const BODIES_TYPES = {
  // Статическое тело
  STATIC: 0,
  // Тело игрока
  PLAYER: 1,
  // Упругое тело
  BOUNCE: 2,
  // Тело пули
  BULLET: 3
};

/**
 * Ограничения количества коррекций столкновений упругого тела
 *
 * @type  {Object}
 */
const BOUNCE_FIXES_LIMIT = {
  // По оси X
  X: 3,
  // По оси Y
  Y: 3
};

/**
 * Следующий уникальный идентификатор
 *
 * @type  {Number}
 */
let nextId = 1;

/**
 * Создает уникальный числовой идентификатор
 *
 * @return  {Number}  Идентификатор
 */
const getNextId = () => {
  return nextId++;
};

export {
  BODIES_TYPES,
  BOUNCE_FIXES_LIMIT,
  getNextId
};
