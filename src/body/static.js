import {
  BODIES_TYPES,
  getNextId
} from '../common';

/**
 * Класс статического тела
 */
class BodyStatic {
  /**
   * Конструктор
   *
   * @param  {Object}   options           Объект с параметрами
   * @param  {Number}   options.x         Позиция по оси X
   * @param  {Number}   options.y         Позиция по оси Y
   * @param  {Number}   options.width     Ширина
   * @param  {Number}   options.height    Высота
   * @param  {Boolean}  options.isSensor  Является ли тело сенсором
   */
  constructor(options) {
    // Позиция
    this.position = {
      x: options.x,
      y: options.y
    };
    // Размеры
    this.size = {
      width: options.width,
      height: options.height
    };
    // Индикатор является ли тело сенсором
    this.isSensor = options.isSensor ? true : false;

    // Уникальный числовой идентификатор
    this.id = getNextId();
    // Установка свойства типа объекта
    this.type = BODIES_TYPES.STATIC;
    // Свойство для хранения пользовательских данных
    this.userData = {};

    // Расчет половинных значений ширины и высоты
    const halfWidth = options.width / 2;
    const halfHeight = options.height / 2;
    // Расчет координат обрамляющего тело прямоугольника
    this.bounds = {
      min: {
        x: -halfWidth + options.x,
        y: -halfHeight + options.y
      },
      max: {
        x: halfWidth + options.x,
        y: halfHeight + options.y
      },
    };
  }
}

export default BodyStatic;
