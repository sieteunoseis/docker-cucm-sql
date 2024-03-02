SELECT
  d.name,
  d.description,
  sd.speeddialindex,
  sd.label,
  sd.speeddialnumber
FROM
  speeddial AS sd
  INNER JOIN device AS d ON sd.fkdevice = d.pkid
ORDER BY
  d.name,
  sd.speeddialindex