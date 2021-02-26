import {
  BODIES_TYPES
} from './common';

/**
 * Проверка нахождения точки за регионом
 *
 * @param   {Object}   vector        Координаты точки
 * @param   {Number}   vector.x      Значение координаты по оси X
 * @param   {Number}   vector.y      Значение координаты по оси Y
 * @param   {Object}   bounds        Объект с координатами региона
 * @param   {Object}   bounds.min    Объект с координатами минимума
 * @param   {Number}   bounds.min.x  Координата минимума по оси X
 * @param   {Number}   bounds.min.y  Координата минимума по оси Y
 * @param   {Object}   bounds.max    Объект с координатами максимума
 * @param   {Number}   bounds.max.x  Координата максимума по оси X
 * @param   {Number}   bounds.max.y  Координата максимума по оси Y
 * @return  {Boolean}                Находится ли точка за регионом
 */
const isOutOfRegion = (vector, bounds) => {
  return vector.x < bounds.min.x ||
         vector.x > bounds.max.x ||
         vector.y < bounds.min.y ||
         vector.y > bounds.max.y;
};

/**
 * Получение ширины и высоты прямоугольника пересечения двух регионов
 *
 * @param   {Object}  boundsA        Объект с координатами первого региона
 * @param   {Object}  boundsA.min    Объект с координатами минимума
 * @param   {Number}  boundsA.min.x  Координата минимума по оси X
 * @param   {Number}  boundsA.min.y  Координата минимума по оси Y
 * @param   {Object}  boundsA.max    Объект с координатами максимума
 * @param   {Number}  boundsA.max.x  Координата максимума по оси X
 * @param   {Number}  boundsA.max.y  Координата максимума по оси Y
 * @param   {Object}  boundsB        Объект с координатами второго региона
 * @param   {Object}  boundsB.min    Объект с координатами минимума
 * @param   {Number}  boundsB.min.x  Координата минимума по оси X
 * @param   {Number}  boundsB.min.y  Координата минимума по оси Y
 * @param   {Object}  boundsB.max    Объект с координатами максимума
 * @param   {Number}  boundsB.max.x  Координата максимума по оси X
 * @param   {Number}  boundsB.max.y  Координата максимума по оси Y
 * @return  {Object}                 Объект с шириной и высотой прямоугольника
 *                                   пересечения
 */
const getIntersection = (boundsA, boundsB) => {
  const maxMinX = Math.max(boundsA.min.x, boundsB.min.x);
  const minMaxX = Math.min(boundsA.max.x, boundsB.max.x);

  const maxMinY = Math.max(boundsA.min.y, boundsB.min.y);
  const minMaxY = Math.min(boundsA.max.y, boundsB.max.y);

  // Ширина и высота прямоугольника пересечения могут быть отрицательными
  // В этом случае пересечение отсутствует
  return {
    width: minMaxX - maxMinX,
    height: minMaxY - maxMinY
  };
};

/**
 * Обработка пересечения линий
 * Сравнение расстройний с текущим результатом,
 * если меньше, изменения текущего результата
 *
 * @param  {Number}  input            Входное значение
 * @param  {Number}  a                Первый коэффициент
 * @param  {Number}  b                Второй коэффициент
 * @param  {Number}  minOutputValue   Минимум выходного значения
 * @param  {Number}  maxOutputValue   Максимум выходного значения
 * @param  {Number}  prevInput        Пердыдущее значение входного значения
 * @param  {Number}  prevOutput       Пердыдущее значение выходного значения
 * @param  {String}  inputAxis        Ось входного значения
 * @param  {String}  outputAxis       Ось выходного значения
 * @param  {Body}    target           Тело столкновения с пулей
 * @param  {Object}  result           Объект с информацией о текущем результате
 * @param  {Object}  result.point     Объект с координатами точки пересечения
 * @param  {Number}  result.point.x   Координата точки пересечения по оси X
 * @param  {Number}  result.point.y   Координата точки пересечения по оси Y
 * @param  {Number}  result.halfSumm  Расстояние текущего результата
 * @param  {Body}    result.target    Тело столкновения с пулей текущего
 *                                    результата
 */
const handlingLineIntersect = (
  input, a, b,
  minOutputValue, maxOutputValue,
  prevInput, prevOutput,
  inputAxis, outputAxis,
  target, result
) => {
  // Если один из коэффициентов равен бесконечности, ничего не делаем
  // Ситуация возникает в случае горизонтально или вертикально двигающейся пули
  if(!isFinite(a) || !isFinite(b)) return;

  // Расчет выходного значения
  var output = -a * input - b;
  // Если выходное значение за границами, ничего не делаем
  if(output <= minOutputValue || output >= maxOutputValue) return;

  // Считаем расстояние (полусумму сторон)
  var halfSumm = Math.abs(output - prevOutput) + Math.abs(input - prevInput);

  // Если полусумма меньше полусуммы текущего результата
  if(halfSumm < result.halfSumm) {
    // Установка значений по осям
    result.point[inputAxis] = input;
    result.point[outputAxis] = output;
    // Установка полусуммы
    result.halfSumm = halfSumm;
    // Установка объекта столкновения с телом пули
    result.target = target;
  }
};

/**
 * Обновление позиций тел, проверка нахождения тел за границами мира
 * и добавление их в список сенсоров
 *
 * @param  {Number}  delta              Время с между текущим
 *                                      и предыдущим кадрами
 * @param  {Array}   bodies             Список тел физического мира
 * @param  {Array}   bodiesToRemove     Список тел для удаления
 *                                      из физического мира
 * @param  {Object}  worldBounds        Границы физического мира
 * @param  {Object}  worldBounds.min    Объект с координатами минимума
 * @param  {Number}  worldBounds.min.x  Координата минимума по оси X
 * @param  {Number}  worldBounds.min.y  Координата минимума по оси Y
 * @param  {Object}  worldBounds.max    Объект с координатами максимума
 * @param  {Number}  worldBounds.max.x  Координата максимума по оси X
 * @param  {Number}  worldBounds.max.y  Координата максимума по оси Y
 * @param  {Array}   sensors            Список сенсоров текущего кадра
 */
const updatePositions = (
  delta, bodies, bodiesToRemove, worldBounds, sensors
) => {
  // Проходим по всем телам
  for(let i = 0, l = bodies.length; i < l; i++) {
    const body = bodies[i];

    // Статические тела не нужно обновлять
    if(body.type === BODIES_TYPES.STATIC) continue;
    // Тела из списка удаления не нужно обновлять
    if(bodiesToRemove.indexOf(body) > -1) continue;

    // Обновление состояния тела
    body.update(delta, bodiesToRemove);

    // Проверка на нахождение позиции объекта за границами мира
    if(isOutOfRegion(body.position, worldBounds)) {
      // Добавление в список удаления
      bodiesToRemove.push(body);
      // Добавление в список сенсоров
      sensors.push({
        isOutWorld: true,
        body: body
      });
    }
  }
};

/**
 * Удаление из физического мира тел из списка для удаления
 *
 * @param  {Array}  bodies          Список тел физического мира
 * @param  {Array}  bodiesToRemove  Список тел для удаления из физического мира
 * @param  {Grid}   broadphase      Экземпляр класса сетки
 */
const removeBodies = (bodies, bodiesToRemove, broadphase) => {
  // Удаление тел из списка для удаления
  for(let i = 0, l = bodiesToRemove.length; i < l; i++) {
    // Удаление тела из сетки
    broadphase.removeBody(bodiesToRemove[i]);

    // Удаление тела из массива тел физического мира
    const index = bodies.indexOf(bodiesToRemove[i]);
    if(index > -1) bodies.splice(index, 1);
  }

  // Очистка массива тел для удаления
  // В том числе очистка в свойстве экземпляра мира
  bodiesToRemove.length = 0;
};

/**
 * Проверка коллизий по парам возможных коллизий,
 * добавление сенсоров в список сенсоров
 *
 * @param  {Object}  broadphasePairs  Пары позможны коллизий
 * @param  {Array}   bodiesToRemove   Список тел для удаления
 *                                    из физического мира
 * @param  {Array}   collisions       Список коллизий текущего кадра
 * @param  {Array}   sensors          Список сенсоров текущего кадра
 */
const detectCollisions = (
  broadphasePairs, bodiesToRemove, collisions, sensors
) => {
  // Объект для хранения списков попаданий пуль
  const bulletsTargets = {};

  // Проходим по парам для проверки коллизии
  for(let pairId in broadphasePairs) {
    // Получение тел пары
    const pair = broadphasePairs[pairId];
    const bodyA = pair.bodyA;
    const bodyB = pair.bodyB;

    // Получение прямоугольника пересечения
    const intersection = getIntersection(bodyA.bounds, bodyB.bounds);

    // Если ширина или высота прямоугольника пересечения
    // отрицательные, ничего не делаем
    if(intersection.width < 0 || intersection.height < 0) continue;

    // Если одно из тел сенсор, добавляем в список сенсоров
    if(bodyA.isSensor || bodyB.isSensor) {
      sensors.push({
        bodyA: bodyA,
        bodyB: bodyB
      });

      // Завершаем итерацию
      continue;
    }

    // Если один из объектов - пуля
    if(bodyA.type === BODIES_TYPES.BULLET ||
       bodyB.type === BODIES_TYPES.BULLET) {
      const bodyBullet = bodyA.type === BODIES_TYPES.BULLET ? bodyA : bodyB;
      const bodyHitted = bodyA.type === BODIES_TYPES.BULLET ? bodyB : bodyA;

      // Если пули нет в списке попаданий пуль, создаем
      if(!bulletsTargets[bodyBullet.id]) {
        bulletsTargets[bodyBullet.id] = {
          bullet: bodyBullet,
          targets: []
        };
      }
      // Добавление тела в которое попали в список попаданий тела пули
      bulletsTargets[bodyBullet.id].targets.push(bodyHitted);

      // Завершаем итерацию
      continue;
    }

    // Добавляем в список коллизий
    collisions.push({
      bodyA: bodyA,
      bodyB: bodyB,
      intersection: intersection
    });
  }

  // Проходим по списку целей пуль
  for(let bulletId in bulletsTargets) {
    // Получение тела пули и списка тел столкновения с ней
    const bullet = bulletsTargets[bulletId].bullet;
    const bulletTargets = bulletsTargets[bulletId].targets;

    // Объект для хранения данных о первом пересечении
    // Первое пересечение - максимально близкое к предыдущей позиции тела пули
    const hitResult = {
      // Минимальная (наиболле близкая к предыдущей позиции тела пули)
      // точка пересечения
      point: { x: 0, y: 0 },
      // Полусумма сторон прямоугольника (сумма катетов)
      // 1) проще расчитывать, чем длинну диагонали (гипотенузы)
      // 2) значение расстояния до точки пересечения
      //    в дальнейшем не используется
      halfSumm: Infinity,
      // Цель попадания
      target: null
    };

    // Проходим по телам столкновения с пулей
    for(let i = 0, l = bulletTargets.length; i < l; i++) {
      const target = bulletTargets[i];

      // Проверка пересечения с минимальным значением по оси X
      handlingLineIntersect(
        target.bounds.min.x, bullet.equationCoefs.ab, bullet.equationCoefs.cb,
        target.bounds.min.y, target.bounds.max.y,
        bullet.prevPosition.x, bullet.prevPosition.y,
        'x', 'y',
        target, hitResult
      );

      // Проверка пересечения с максимальным значением по оси X
      handlingLineIntersect(
        target.bounds.max.x, bullet.equationCoefs.ab, bullet.equationCoefs.cb,
        target.bounds.min.y, target.bounds.max.y,
        bullet.prevPosition.x, bullet.prevPosition.y,
        'x', 'y',
        target, hitResult
      );

      // Проверка пересечения с минимальным значением по оси Y
      handlingLineIntersect(
        target.bounds.min.y, bullet.equationCoefs.ba, bullet.equationCoefs.ca,
        target.bounds.min.x, target.bounds.max.x,
        bullet.prevPosition.y, bullet.prevPosition.x,
        'y', 'x',
        target, hitResult
      );

      // Проверка пересечения с максимальным значением по оси Y
      handlingLineIntersect(
        target.bounds.max.y, bullet.equationCoefs.ba, bullet.equationCoefs.ca,
        target.bounds.min.x, target.bounds.max.x,
        bullet.prevPosition.y, bullet.prevPosition.x,
        'y', 'x',
        target, hitResult
      );
    }

    // Если не указана цель, значит столкновений нет
    if(hitResult.target === null) continue;

    // Если у пули нет длинны жизни или она попала в статический объект
    // добавляем пулю в список для удаления
    if(bullet.longOfLife === false ||
       hitResult.target.type === BODIES_TYPES.STATIC) {
      bodiesToRemove.push(bullet);
    }

    // Добавляем в список сенсоров
    sensors.push({
      isHit: true,
      bodyBullet: bullet,
      bodyHitted: hitResult.target,
      point: hitResult.point
    });
  }
};

/**
 * Коррекция позиция объектов в зависимости от коллизий
 *
 * @param  {Array}  collisions  Список коллизий текущего кадра
 */
const correctionPositions = collisions => {
  // Проходим по все коллизиям
  for(let i = 0, l = collisions.length; i < l; i++) {
    const collision = collisions[i];

    // Получаем объекты тел столкновений
    const bodyA = collision.bodyA;
    const bodyB = collision.bodyB;

    // В восстановление позиций попадают такие пары тел:
    // - игрок и статическое тело
    // - упругое тело и статическое тело
    // В переменную resolvedBody записываем тело игрока или упругое тело
    let resolvedBody;
    let staticBody;
    if(bodyA.type === BODIES_TYPES.PLAYER ||
       bodyA.type === BODIES_TYPES.BOUNCE) {
      resolvedBody = bodyA;
      staticBody = bodyB;
    } else {
      resolvedBody = bodyB;
      staticBody = bodyA;
    }

    // Получаем пересечение
    const correction = {
      x: collision.intersection.width,
      y: collision.intersection.height
    };

    // Свойство необходимости применения стандартного
    // исправления по меньшему пересечению
    let needMinIntersectFix = true;

    // Получаем ограничивающие прямоугольники тел
    const boundsResolved = resolvedBody.bounds;
    const boundsStatic = staticBody.bounds;
    // Не учитывается пересечение по оси X
    // если левая и правая стороны тела для восстановления позиции
    // находятся между левой и правой сторонами статического тела
    if(boundsResolved.min.x > boundsStatic.min.x &&
       boundsResolved.max.x < boundsStatic.max.x) {
      correction.x = 0;
      needMinIntersectFix = false;
    }
    // Не учитывается пересечение по оси Y
    // если верхняя и нижняя стороны тела для восстановления позиции
    // находятся между верхней и нижней сторонами статического тела
    if(boundsResolved.min.y > boundsStatic.min.y &&
       boundsResolved.max.y < boundsStatic.max.y) {
      correction.y = 0;
      needMinIntersectFix = false;
    }

    // Если есть пересечение по оси Y
    // и тело для восстановления позиции находится над статическим телом
    if(correction.y !== 0 && resolvedBody.position.y < staticBody.position.y) {
      // Если тело для восстановления - тело игрока
      // и тело для восстановления движется вверх
      // и тело для восстановления не на земле
      if(resolvedBody.type === BODIES_TYPES.PLAYER &&
         resolvedBody.moveDirectionY === -1 &&
         !resolvedBody.isOnGround) {
        // Не учитываем пересечение по оси Y
        correction.y = 0;
        needMinIntersectFix = false;
      }

      // Если тело для восстановления движется вниз
      // и пересечение по оси Y меньше чем пересечение по оси X
      if(resolvedBody.moveDirectionY === 1 &&
         correction.y < correction.x) {
        // Не учитываем пересечение по оси X
        correction.x = 0;
        needMinIntersectFix = false;
      }
    }

    // Если необхоидмо использовать исправление по минимальной величине
    // (не были использованые другие исправления)
    if(needMinIntersectFix) {
      // Если пересечение по оси X меньше пересечения по оси Y,
      // сбрасываем пересечение по оси Y
      if(correction.x < correction.y) correction.y = 0;
      // Иначе сбрасываем пересечение по оси X
      else correction.x = 0;
    }

    // Изменение направления вектора пересечения в зависимости от позиции
    // тела для восстановления позиции по отношению к статическому
    if(resolvedBody.position.y < staticBody.position.y) correction.y *= -1;
    if(resolvedBody.position.x < staticBody.position.x) correction.x *= -1;

    // Обновление тела с учетом вектора корректировки
    resolvedBody.updateCollision(correction);
    // Восстановление позиций
    resolvedBody.setPosition({
      x: resolvedBody.position.x + correction.x,
      y: resolvedBody.position.y + correction.y
    });
  }
};

/**
 * Вспомогательные действия после обновления физического мира
 *
 * @param  {Array}  bodies  Список тел физического мира
 */
const afterUpdate = bodies => {
  // Проход по телам
  for(let i = 0, l = bodies.length; i < l; i++) {
    const body = bodies[i];

    // Если под телом игрока нет платформ
    // и не установлены таймеры прыжка и падения
    if(body.type === BODIES_TYPES.PLAYER &&
       !body.isOnGround &&
       body.jumpTimer === false &&
       body.fallTimer === false) {
      // Устанавливаем таймер падения и последнюю позицию на земле
      body.fallTimer = 0;
      body.lastGroundPositionY = body.position.y;
    }
  }
};

export {
  updatePositions,
  removeBodies,
  detectCollisions,
  correctionPositions,
  afterUpdate
};
