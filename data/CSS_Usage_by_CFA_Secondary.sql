/*css distro CFA secondary*/
SELECT
  css.name,
  COUNT(*) AS COUNT
FROM
  callingsearchspace css
  INNER JOIN callforwarddynamic cfd ON cfd.fkcallingsearchspace_scfa = css.pkid
GROUP BY
  css.name