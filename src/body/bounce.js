import {
  BODIES_TYPES,
  BOUNCE_FIXES_LIMIT,
  getNextId
} from '../common';

/**
 * Класс упругого тела
 */
class BodyBounce {
  /**
   * Конструктор
   *
   * @param  {Object}  options          Объект с параметрами
   * @param  {Number}  options.x        Позиция по оси X
   * @param  {Number}  options.y        Позиция по оси Y
   * @param  {Number}  options.width    Ширина
   * @param  {Number}  options.height   Высота
   * @param  {Object}  options.force    Вектор движения тела
   * @param  {Number}  options.force.x  Движения по оси X, пунктов/с
   * @param  {Number}  options.force.y  Движение по оси Y, пунктов/с
   * @param  {Number}  options.gravity  Значение гравитации физического мира
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
    // Направление движения
    // Делится на 1000, так как в параметрах приходит пунктов/с,
    // а необходимо пунктов/мс
    this.force = {
      x: options.force.x / 1000,
      y: options.force.y / 1000
    };
    // Значение гравитации
    this.gravity = options.gravity;

    // Скорость отскока по оси Y
    // Меняется знак,
    // так как отскок происходит в отрицательном направлении оси Y
    this.reboundSpeed = this.force.y > 0 ? -this.force.y : this.force.y;
    // Индикатор [-1, 0, 1] перемещения тела по оси Y на текущем кадре
    // Необходимо для корректировки позиции при коллизии
    this.moveDirectionY = 0;
    // Статус обновления позиции или размеров на текущем тике
    this.isUpdated = false;


    this.countCollisionsFix = {
      x: 0,
      y: 0
    };

    // Уникальный числовой идентификатор
    this.id = getNextId();
    // Установка свойства типа объекта
    this.type = BODIES_TYPES.BOUNCE;
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
      max: { x: 0, y: 0 }
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
  setPosition(position) {
    // Установка позиции
    this.position.x = position.x;
    this.position.y = position.y;

    // Установка свойства обновления тела
    this.isUpdated = true;
    // Обновлять координаты обрамляющего прямоугольника не нужно,
    // так как это будет сделано в следующий тик в методе update
  }

  /**
   * Обновление тела
   * ВАЖНО: текущий вариант не учитывает возможность разрушения платформы
   * под упругим телом и применение гравитации, в случае добавления
   * стоительства, необходимо переписать метод update
   *
   * @param  {Number}  delta  Время между предыдущим и текущим тиком
   */
  update(delta) {
    // Если не достигнут лимит исправлений по оси X
    if(this.countCollisionsFix.x < BOUNCE_FIXES_LIMIT.X) {
      // Изменяем позицию по оси X
      this.position.x += this.force.x * delta;

      // Устанавливаем свойство индикатора обновления
      this.isUpdated = true;
    }

    // Если не достигнут лимит исправлений по оси Y
    if(this.countCollisionsFix.y < BOUNCE_FIXES_LIMIT.Y) {
      // Изменяем позицию по оси Y
      this.position.y += this.force.y * delta;
      // Изменяем направление движения с учетом гравитации
      this.force.y += this.gravity * delta;

      // Устанавливаем индикатор перемещения тела по оси Y
      this.moveDirectionY = this.force.y > 0 ? 1 : -1;
      // Устанавливаем свойство индикатора обновления
      this.isUpdated = true;
    }

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
    // Если количество исправлений по оси X меньше или равно лимиту
    if(this.countCollisionsFix.x <= BOUNCE_FIXES_LIMIT.X) {
      // Если количество исправлений по оси X равно лимиту
      if(this.countCollisionsFix.x === BOUNCE_FIXES_LIMIT.X) {
        // Отключаем перемещение по оси X
        this.force.x = 0;
      }
      // Иначе
      else {
        // При любом столкновении уменьшаем скорость по оси X
        this.force.x *= 0.5 - 0.1 * this.countCollisionsFix.x;

        // Если столкновение сбоку и не с той стороны в которую движется тело
        if(correction.x != 0 &&
           Math.sign(correction.x) != Math.sign(this.force.x)) {
          // Меняем направлеие движения по оси X
          this.force.x *= -1;
        }

        // Увеличиваем счетчик количества осправлений по оси X
        this.countCollisionsFix.x++;
      }
    }

    // Если есть столкновение по оси Y
    // и количество исправлений по оси Y меньше или равно лимиту
    if(correction.y !== 0 &&
       this.countCollisionsFix.y <= BOUNCE_FIXES_LIMIT.Y) {
      // Если столкновение снизу
      if(correction.y < 0) {
        // Если количество исправлений по оси Y равно лимиту
        if(this.countCollisionsFix.y === BOUNCE_FIXES_LIMIT.Y) {
          // Отключаем перемещение по оси Y
          this.force.y = 0;
          // Сбрасываем индикатор перемещения тела по оси Y
          this.moveDirectionY = 0;
        }
        // Иначе
        else {
          // Уменьшаем скорость отскока
          this.reboundSpeed *= 0.5 - 0.15 * this.countCollisionsFix.y;
          // Устанавливаем направление движения в скорость отскока
          this.force.y = this.reboundSpeed;

          // Увеличиваем счетчик количества осправлений по оси Y
          this.countCollisionsFix.y++;
        }
      }

      // Если столкновение сверху, меняем направление по оси Y
      if(correction.y > 0) this.force.y *= -1;
    }
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

export default BodyBounce;
