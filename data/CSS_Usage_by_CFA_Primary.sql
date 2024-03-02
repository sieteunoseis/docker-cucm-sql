/*css distro CFA primary*/
SELECT
  css.name,
  COUNT(*) AS COUNT
FROM
  callingsearchspace css
  INNER JOIN callforwarddynamic cfd ON cfd.fkcallingsearchspace_cfa = css.pkid
GROUP BY
  css.name