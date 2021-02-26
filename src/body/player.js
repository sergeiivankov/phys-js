import {
  BODIES_TYPES,
  getNextId
} from '../common';

/**
 * Класс тела игрока
 */
class BodyPlayer {
  /**
   * Конструктор
   *
   * @param  {Object}  options               Объект с параметрами
   * @param  {Number}  options.x             Позиция по оси X
   * @param  {Number}  options.y             Позиция по оси Y
   * @param  {Number}  options.width         Ширина объекта
   * @param  {Number}  options.height        Высота объекта
   * @param  {Number}  options.moveSpeed     Скорость движения по оси X
   * @param  {Number}  options.jumpDistance  Высота прыжка
   * @param  {Number}  options.gravity       Значение гравитации
   *                                         физического мира
   */
  constructor(options) {
    // Позиция объекта
    this.position = {
      x: options.x,
      y: options.y
    };
    // Размеры объекта
    this.size = {
      width: options.width,
      height: options.height
    };
    // Скорость горизонтального перемещения
    // Переданное в параметрах значение делится на 1000,
    // так как передается в единицах в секунду
    this.moveSpeed = options.moveSpeed
      ? options.moveSpeed / 1000
      : 0.4;
    // Высота прыжка
    this.jumpDistance = options.jumpDistance || options.height * 1.1;
    // Значение гравитации
    this.gravity = options.gravity;
    // Коэффициент для расчета расстояния в прыжке
    this.jumpCoef = Math.sqrt(this.jumpDistance / this.gravity);

    // Последняя позиция нахождения на земле по оси Y до прыжка или падения
    this.lastGroundPositionY = options.y || 0;
    // Направление движения тела по горизонтали
    this.forceX = 0;
    // Индикатор [-1, 0, 1] перемещения тела по оси Y на текущем кадре
    // Необходимо для корректировки позиции при коллизии
    this.moveDirectionY = 0;
    // Статус нахождения на платформе
    this.isOnGround = false;
    // Индикатор изначального горизонтального направления при прыжке
    this.jumpInitDir = 0;
    // Статус обновления позиции или размеров на текущем тике
    this.isUpdated = false;

    // Таймер прыжка
    this.jumpTimer = false;
    // Таймер падения для корректного расчета позиции
    this.fallTimer = false;

    // Уникальный числовой идентификатор
    this.id = getNextId();
    // Установка свойства типа объекта
    this.type = BODIES_TYPES.PLAYER;
    // Свойство для хранения пользовательских данных
    this.userData = {};

    // Расчет половинных значений ширины и высоты
    const halfWidth = options.width / 2;
    const halfHeight = options.height / 2;
    // Расчет значений нормализованных (приведенных к началу координат)
    // координат обрамляющего прямоугольника
    this.normalBounds = {
      min: {
        x: -halfWidth,
        y: -halfHeight
      },
      max: {
        x: halfWidth,
        y: halfHeight
      }
    };
    // Инициализация значения координат обрамляющего прямоугольника
    this.bounds = {
      min: { x: 0, y: 0 },
      max: { x: 0, y: 0 },
    };
    // Обновление координат обрамляющего прямоугольника
    this._updateBounds();
  }

  /**
   * Установка позиции телу игрока
   *
   * @param  {Object}  position    Объект с координатами
   * @param  {Number}  position.x  Координата по оси X
   * @param  {Number}  position.y  Координата по оси Y
   */
  setPosition(newPosition) {
    // Установка позиции
    const position = this.position;
    position.x = newPosition.x;
    position.y = newPosition.y;

    // Установка свойства обновления тела
    this.isUpdated = true;
    // Обновлять координаты обрамляющего прямоугольника не нужно,
    // так как это будет сделано в следующий тик в методе update
  }

  /**
   * Обновление тела
   *
   * @param  {Number}  delta  Время между предыдущим и текущим тиком
   */
  update(delta) {
    // Если есть направление движения по оси X
    if(this.forceX) {
      // Устанавливаем свойство индикатора обновления
      this.isUpdated = true;

      // Устанавливаем позицию по оси X
      // в зависимости от направления движения
      this.position.x += this.forceX * delta;

      // Если тело на земле
      if(this.isOnGround) {
        // Сбрасываем направление движения по оси X
        //this.forceX = 0;

        // ВАЖНО: не учитывает разрушаемость платформ под игроком
        // Закомментировать в случае добавления строительства
        //
        // Добавляем к позиции Y +1 для подтверждения нахождения на земле
        this.position.y += 1;
        // Сбрасываем значение свойства нахождения на платформе
        this.isOnGround = false;
      }
    }

    // Сбрасываем индикатор движения по оси Y
    this.moveDirectionY = 0;

    // Если запущен таймер прыжка
    if(this.jumpTimer !== false) {
      // Расстояние прыжка (по оси Y) вычисляется по формуле a * (x - c)^2 - b
      // где x - время с начала прыжка
      //     a - значение гравитации
      //     b - высота прыжка
      //     с - квадратный корень из отношения высоты прыжка к гравитации,
      //         необходим для создания пересечения паработы и центра координат

      // Добавляем дельту к таймеру прыжка
      this.jumpTimer += delta;

      // Добавляет расстояние к последней позиции на земле по оси Y
      this.position.y = this.lastGroundPositionY
        + this.gravity * Math.pow(this.jumpTimer - this.jumpCoef, 2)
        - this.jumpDistance;

      // Устанавливаем индикатор движения по оси Y
      this.moveDirectionY = this.jumpTimer - this.jumpCoef > 0 ? 1 : -1;

      // Устанавливаем свойство индикатора обновления
      this.isUpdated = true;
    }

    // Если тело не на земле и таймер прыжка не запущен,
    // то тело в состоянии падения
    if(!this.isOnGround && this.fallTimer !== false) {
      // Расстояние падения (по оси Y) вычисляется по формуле a * x^2
      // где x - время с начала падения
      //     a - значение гравитации

      // Добавляем дельту к таймеру падения
      this.fallTimer += delta;

      // Добавляет расстояние к последней позиции на земле по оси Y
      this.position.y = this.lastGroundPositionY
                      + this.gravity * Math.pow(this.fallTimer, 2);

      // Устанавливаем индикатор движения по оси Y
      this.moveDirectionY = 1;

      // Устанавливаем свойство индикатора обновления
      this.isUpdated = true;
    }

    // ВАЖНО: учитывает разрушаемость платформ под игроком
    // Раскомментировать в случае добавления строительства
    //
    // Добавляем к позиции Y +1 для подтверждения нахождения на земле
    //if(this.isOnGround) this.position.y += 1;
    // Сбрасываем значение свойства нахождения на платформе
    //this.isOnGround = false;

    // Обновляем координаты вершин и обрамляющего прямоугольника
    // если есть обновление
    if(this.isUpdated) this._updateBounds();
  }

  /**
   * Обновление тела после столкновения
   *
   * @param  {Object}  correction    Вектор корректировки позиции
   * @param  {Number}  correction.x  Корректировка по оси X
   * @param  {Number}  correction.y  Корректировка по оси Y
   */
  updateCollision(correction) {
    // Если есть пересечение по оси X
    if(correction.x != 0) {
      // Сбрасываем значение направления прыжка и движения по оси X
      this.jumpInitDir = 0;
      //this.forceX = 0;
    }

    // Столкновение нижней стороной
    if(correction.y < 0) {
      // Установка статуса "на земле"
      this.isOnGround = true;
      // Сброс значения направления прыжка
      this.jumpInitDir = 0;
      // Сброс таймеров прыжка и падения
      this.jumpTimer = false;
      this.fallTimer = false;
      // Сброс двжиения по оси X
      //this.forceX = 0;
    }

    // Столкновение верхней стороной
    if(correction.y > 0) {
      // Отключение таймера прыжка
      this.jumpTimer = false;
      // Сброс значения направления прыжка
      this.jumpInitDir = 0;
    }
  }

  /**
   * Движение тела игрока
   *
   * @param  {Number}  dir  Направление движения
   *                        -1 = движение влево
   *                        1 = движение вправо
   */
  move(dir) {
    // Устанавливаем скорость горизонтального движения
    this.forceX = this.moveSpeed * dir;

    // Если тело не на земле
    // и направление не равно изначальному напрвлению прыжка
    if(!this.isOnGround && dir != this.jumpInitDir) {
      // Сбрасываем значение изначального направления прыжка
      this.jumpInitDir = 0;
      // Снижаем скорость горизонтального движения в 2 раза
      this.forceX /= 2;
    }
  }

  stop() {
    this.forceX = 0;
  }

  /**
   * Прыжок тела игрока
   */
  jump() {
    // Если тело не на земле, ничего не делаем
    if(!this.isOnGround) return;

    // Устанавливаем таймер прыжка в значение 0
    this.jumpTimer = 0;
    // Устанавливаем текущую позицию оси Y
    // в значение последней позиции на земле по оси Y
    this.lastGroundPositionY = this.position.y;

    // В зависимости от текущего направления движения
    // устанавливаем значение изначального направления прыжка
    if(this.forceX < 0) this.jumpInitDir = -1;
    if(this.forceX > 0) this.jumpInitDir = 1;

    this.isOnGround = false;
  }

  /**
   * Обновляет координаты обрамляющего прямоугольника
   *
   * Зависят от нормализованных координат обрамляющего прямоугольника
   * (this.normalBounds) и позиции (this.position)
   */
  _updateBounds() {
    const normalBounds = this.normalBounds;
    const position = this.position;
    const bounds = this.bounds;

    bounds.min.x = normalBounds.min.x + position.x;
    bounds.min.y = normalBounds.min.y + position.y;
    bounds.max.x = normalBounds.max.x + position.x;
    bounds.max.y = normalBounds.max.y + position.y;
  }
}

export default BodyPlayer;
