import {
  BODIES_TYPES,
  getNextId
} from '../common';

/**
 * Класс тела пули
 */
class BodyBullet {
  /**
   * Конструктор
   *
   * @param  {Object}  options             Объект с параметрами
   * @param  {Number}  options.x           Позиция по оси X
   * @param  {Number}  options.y           Позиция по оси Y
   * @param  {Object}  options.force       Вектор движения тела
   * @param  {Number}  options.force.x     Движения по оси X, пунктов/с
   * @param  {Number}  options.force.y     Движение по оси Y, пунктов/с
   * @param  {Number}  options.ownerId     Идентификатор тела владельца
   * @param  {Number}  options.longOfLife  Длинна жизни тела пули
   */
  constructor(options) {
    // Позиция объекта
    this.position = {
      x: options.x,
      y: options.y
    };
    // Позиция объекта на предыдущем кадре
    this.prevPosition = {
      x: options.x,
      y: options.y
    };
    // Направление движения
    // Делится на 1000, так как в параметрах приходит пунктов/с,
    // а необходимо пунктов/мс
    this.force = {
      x: options.force.x / 1000,
      y: options.force.y / 1000
    };

    // Идентификатор тела владельца пули
    // Для предовращения проверки столкновений тела владельца и тела пули
    this.ownerId = options.ownerId || 0;
    // Индикатор обновления постоянно в положительном состоянии
    // так как тело пули находится в постоянном движении
    this.isUpdated = true;

    // Длинна жизни пули
    // При продвижении на данную дистанцию, пуля уничтожается
    // Необходимо для ограничения полета осколков гранаты
    // TODO: пересмотреть логику с длинной жизни пули,
    //       есть подозрение, что совершаются лишние действия
    this.longOfLife = options.longOfLife || false;
    // Если есть свойство длинны жихни, устанавливаем свойство пройденной длинны
    if(options.longOfLife) this.long = 0;

    // Расчет коэффициентов уравления прямой пути тела пули
    // Уравнение прямой имеет вид: a*x + b*y + c = 0
    // где a = y1 - y2
    //     b = x2 - x1
    //     c = x1*y2 - x2*y1
    // Первая точка - позиция пули
    // Вторая точка - позиция + направление движения
    const coefs = {
      a: -this.force.y,
      b: this.force.x,
      c: options.x * this.force.y - options.y * this.force.x
    };
    // Установка в свойства тела коэффициентов для расчета точек пересечения
    // Формула расчета пересечения с прямой x = K:
    // y = - (a/b) * x - (c/b)
    // Формула расчета пересечения с прямой y = K:
    // x = - (b/a) * y - (c/b)
    this.equationCoefs = {
      ab: coefs.a / coefs.b,
      ba: coefs.b / coefs.a,
      ca: coefs.c / coefs.a,
      cb: coefs.c / coefs.b
    };

    // Уникальный числовой идентификатор
    this.id = getNextId();
    // Установка свойства типа объекта
    this.type = BODIES_TYPES.BULLET;
    // Свойство для хранения пользовательских данных
    this.userData = {};

    // Инициализация значения координат обрамляющего прямоугольника
    this.bounds = {
      min: { x: 0, y: 0 },
      max: { x: 0, y: 0 }
    };
    // Обновление координат обрамляющего прямоугольника
    this._updateBounds();
  }

  /**
   * Обновление тела
   *
   * @param  {Number}  delta           Время между предыдущим и текущим тиком
   * @param  {Array}   bodiesToRemove  Список обхектов для удаления
   */
  update(delta, bodiesToRemove) {
    const position = this.position;
    const prevPosition = this.prevPosition;
    const force = this.force;
    const longOfLife = this.longOfLife;

    // Установка предыдущей позиции
    prevPosition.x = position.x;
    prevPosition.y = position.y;

    // Установка новой текущей позиции
    const moveX = force.x * delta;
    const moveY = force.y * delta;
    position.x += moveX;
    position.y += moveY;

    // Если задана длинна жизни тела пули
    if(longOfLife !== false) {
      // Увеличиваем пройденную длинну
      this.long += Math.sqrt(moveX * moveX + moveY * moveY);

      // Если пройденная длинна больше длинны жизни
      if(this.long >= longOfLife) {
        // Добавляем в список для удаления
        bodiesToRemove.push(this);
        // Завершаем работу функции чтобы лишний раз не обновлять
        // обрамляющий прямоугольник
        return;
      }
    }

    // Обновление координат обрамляющего прямоугольника
    this._updateBounds();
  }

  /**
   * Обновляет координаты обрамляющего прямоугольника
   *
   * Зависят от текущей (this.position)
   * и предыдущей (this.prevPosition) позиций тела
   */
  _updateBounds() {
    const position = this.position;
    const prevPosition = this.prevPosition;
    const bounds = this.bounds;

    bounds.min.x = Math.min(position.x, prevPosition.x);
    bounds.min.y = Math.min(position.y, prevPosition.y);
    bounds.max.x = Math.max(position.x, prevPosition.x);
    bounds.max.y = Math.max(position.y, prevPosition.y);
  }
}

export default BodyBullet;
